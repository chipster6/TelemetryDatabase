#!/bin/bash

# Security scanning script for Docker images and dependencies
# This script performs comprehensive security analysis

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="telemetry-llm-service:secure"
SCAN_RESULTS_DIR="./security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}🔒 Starting Security Scan for LLM Service${NC}"
echo "=================================================="

# Create results directory
mkdir -p "${SCAN_RESULTS_DIR}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install security tools
install_security_tools() {
    echo -e "${YELLOW}📦 Installing security scanning tools...${NC}"
    
    # Install Docker Scout (if not present)
    if ! command_exists docker-scout; then
        echo "Installing Docker Scout..."
        curl -sSfL https://raw.githubusercontent.com/docker/scout-cli/main/install.sh | sh -s --
    fi
    
    # Install Trivy (if not present)
    if ! command_exists trivy; then
        echo "Installing Trivy..."
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    # Install Hadolint (if not present)
    if ! command_exists hadolint; then
        echo "Installing Hadolint..."
        wget -O /usr/local/bin/hadolint https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64
        chmod +x /usr/local/bin/hadolint
    fi
    
    # Install npm audit
    if ! command_exists npm; then
        echo -e "${RED}❌ npm not found. Please install Node.js first.${NC}"
        exit 1
    fi
}

# Function to scan Dockerfile with Hadolint
scan_dockerfile() {
    echo -e "${BLUE}🔍 Scanning Dockerfile for security issues...${NC}"
    
    local dockerfile="Dockerfile.secure"
    local output_file="${SCAN_RESULTS_DIR}/hadolint_${TIMESTAMP}.txt"
    
    if [[ -f "$dockerfile" ]]; then
        hadolint "$dockerfile" > "$output_file" 2>&1 || true
        
        if [[ -s "$output_file" ]]; then
            echo -e "${YELLOW}⚠️  Dockerfile issues found:${NC}"
            cat "$output_file"
        else
            echo -e "${GREEN}✅ Dockerfile security scan passed${NC}"
        fi
    else
        echo -e "${RED}❌ Dockerfile.secure not found${NC}"
    fi
}

# Function to scan image with Trivy
scan_image_trivy() {
    echo -e "${BLUE}🔍 Scanning image with Trivy...${NC}"
    
    local output_file="${SCAN_RESULTS_DIR}/trivy_${TIMESTAMP}.json"
    
    # Build image if it doesn't exist
    if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
        echo "Building secure image..."
        docker build -f Dockerfile.secure -t "$IMAGE_NAME" .
    fi
    
    # Scan for vulnerabilities
    trivy image \
        --format json \
        --output "$output_file" \
        --severity HIGH,CRITICAL \
        --ignore-unfixed \
        "$IMAGE_NAME"
    
    # Generate human-readable report
    trivy image \
        --format table \
        --severity HIGH,CRITICAL \
        --ignore-unfixed \
        "$IMAGE_NAME" > "${SCAN_RESULTS_DIR}/trivy_${TIMESTAMP}.txt"
    
    # Check for critical vulnerabilities
    local critical_count
    critical_count=$(jq '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | .VulnerabilityID' "$output_file" 2>/dev/null | wc -l || echo "0")
    
    if [[ "$critical_count" -gt 0 ]]; then
        echo -e "${RED}❌ Found $critical_count critical vulnerabilities${NC}"
        return 1
    else
        echo -e "${GREEN}✅ No critical vulnerabilities found${NC}"
    fi
}

# Function to scan with Docker Scout
scan_image_scout() {
    echo -e "${BLUE}🔍 Scanning image with Docker Scout...${NC}"
    
    local output_file="${SCAN_RESULTS_DIR}/docker_scout_${TIMESTAMP}.json"
    
    # Scan with Docker Scout
    docker scout cves \
        --format json \
        --output "$output_file" \
        "$IMAGE_NAME" || true
    
    # Generate summary
    docker scout quickview "$IMAGE_NAME" > "${SCAN_RESULTS_DIR}/docker_scout_summary_${TIMESTAMP}.txt" || true
    
    echo -e "${GREEN}✅ Docker Scout scan completed${NC}"
}

# Function to scan Node.js dependencies
scan_npm_dependencies() {
    echo -e "${BLUE}🔍 Scanning Node.js dependencies...${NC}"
    
    local output_file="${SCAN_RESULTS_DIR}/npm_audit_${TIMESTAMP}.json"
    
    # Run npm audit
    npm audit --json > "$output_file" 2>/dev/null || true
    
    # Check for high/critical vulnerabilities
    local critical_count
    critical_count=$(jq '.vulnerabilities | to_entries[] | select(.value.severity == "critical" or .value.severity == "high") | .key' "$output_file" 2>/dev/null | wc -l || echo "0")
    
    if [[ "$critical_count" -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Found $critical_count high/critical npm vulnerabilities${NC}"
        npm audit --audit-level=high > "${SCAN_RESULTS_DIR}/npm_audit_${TIMESTAMP}.txt" || true
    else
        echo -e "${GREEN}✅ No critical npm vulnerabilities found${NC}"
    fi
}

# Function to check security configurations
check_security_configs() {
    echo -e "${BLUE}🔍 Checking security configurations...${NC}"
    
    local config_file="${SCAN_RESULTS_DIR}/security_config_${TIMESTAMP}.txt"
    
    {
        echo "Security Configuration Analysis"
        echo "==============================="
        echo
        
        # Check Docker Compose security
        if [[ -f "docker-compose.security.yml" ]]; then
            echo "✅ Secure Docker Compose configuration found"
            
            # Check for security features
            if grep -q "read_only: true" docker-compose.security.yml; then
                echo "✅ Read-only filesystem configured"
            else
                echo "⚠️  Read-only filesystem not configured"
            fi
            
            if grep -q "cap_drop:" docker-compose.security.yml; then
                echo "✅ Capabilities dropped"
            else
                echo "⚠️  Capabilities not dropped"
            fi
            
            if grep -q "no-new-privileges" docker-compose.security.yml; then
                echo "✅ No-new-privileges configured"
            else
                echo "⚠️  No-new-privileges not configured"
            fi
            
            if grep -q "user:" docker-compose.security.yml; then
                echo "✅ Non-root user configured"
            else
                echo "⚠️  Non-root user not configured"
            fi
        else
            echo "❌ Secure Docker Compose configuration not found"
        fi
        
        echo
        
        # Check package.json for security
        if [[ -f "package.json" ]]; then
            echo "Package.json Security Analysis:"
            
            if jq -e '.scripts.audit' package.json >/dev/null 2>&1; then
                echo "✅ npm audit script configured"
            else
                echo "⚠️  npm audit script not configured"
            fi
            
            # Check for security-related packages
            if jq -e '.dependencies.helmet' package.json >/dev/null 2>&1; then
                echo "✅ Helmet security middleware found"
            else
                echo "⚠️  Helmet security middleware not found"
            fi
            
            if jq -e '.dependencies."express-rate-limit"' package.json >/dev/null 2>&1; then
                echo "✅ Rate limiting middleware found"
            else
                echo "⚠️  Rate limiting middleware not found"
            fi
        fi
        
    } > "$config_file"
    
    cat "$config_file"
}

# Function to generate security report
generate_security_report() {
    echo -e "${BLUE}📊 Generating security report...${NC}"
    
    local report_file="${SCAN_RESULTS_DIR}/security_report_${TIMESTAMP}.md"
    
    {
        echo "# Security Scan Report"
        echo "Generated: $(date)"
        echo "Image: $IMAGE_NAME"
        echo
        
        echo "## Executive Summary"
        echo
        
        # Count total issues
        local total_issues=0
        
        if [[ -f "${SCAN_RESULTS_DIR}/trivy_${TIMESTAMP}.json" ]]; then
            local trivy_issues
            trivy_issues=$(jq '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")' "${SCAN_RESULTS_DIR}/trivy_${TIMESTAMP}.json" 2>/dev/null | jq -s length || echo "0")
            total_issues=$((total_issues + trivy_issues))
            echo "- Trivy vulnerabilities (HIGH/CRITICAL): $trivy_issues"
        fi
        
        if [[ -f "${SCAN_RESULTS_DIR}/npm_audit_${TIMESTAMP}.json" ]]; then
            local npm_issues
            npm_issues=$(jq '.vulnerabilities | to_entries[] | select(.value.severity == "critical" or .value.severity == "high")' "${SCAN_RESULTS_DIR}/npm_audit_${TIMESTAMP}.json" 2>/dev/null | jq -s length || echo "0")
            total_issues=$((total_issues + npm_issues))
            echo "- npm vulnerabilities (HIGH/CRITICAL): $npm_issues"
        fi
        
        echo "- **Total critical issues: $total_issues**"
        echo
        
        if [[ $total_issues -eq 0 ]]; then
            echo "🟢 **Status: PASS** - No critical security issues found"
        elif [[ $total_issues -le 5 ]]; then
            echo "🟡 **Status: REVIEW** - Some issues found, review recommended"
        else
            echo "🔴 **Status: FAIL** - Critical security issues must be addressed"
        fi
        
        echo
        echo "## Detailed Results"
        echo
        
        # Include scan results
        for file in "${SCAN_RESULTS_DIR}"/*_"${TIMESTAMP}".txt; do
            if [[ -f "$file" ]]; then
                local filename
                filename=$(basename "$file")
                echo "### $filename"
                echo '```'
                head -50 "$file"  # Limit output size
                echo '```'
                echo
            fi
        done
        
    } > "$report_file"
    
    echo -e "${GREEN}✅ Security report generated: $report_file${NC}"
}

# Function to check for secrets in code
scan_secrets() {
    echo -e "${BLUE}🔍 Scanning for exposed secrets...${NC}"
    
    local output_file="${SCAN_RESULTS_DIR}/secrets_scan_${TIMESTAMP}.txt"
    
    {
        echo "Secret Scanning Results"
        echo "======================"
        echo
        
        # Common secret patterns
        echo "Checking for potential secrets:"
        
        # API keys
        if grep -r -n "api_key\|apikey\|api-key" src/ --include="*.ts" --include="*.js" 2>/dev/null; then
            echo "⚠️  Potential API keys found in source code"
        else
            echo "✅ No API keys found in source code"
        fi
        
        # Passwords
        if grep -r -n "password\|passwd" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "//"; then
            echo "⚠️  Potential passwords found in source code"
        else
            echo "✅ No passwords found in source code"
        fi
        
        # Tokens
        if grep -r -n "token\|secret" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "//"; then
            echo "⚠️  Potential tokens/secrets found in source code"
        else
            echo "✅ No tokens/secrets found in source code"
        fi
        
        # Private keys
        if grep -r -n "BEGIN.*PRIVATE KEY" . 2>/dev/null; then
            echo "❌ Private keys found in repository"
        else
            echo "✅ No private keys found in repository"
        fi
        
    } > "$output_file"
    
    cat "$output_file"
}

# Main execution
main() {
    echo -e "${BLUE}Starting comprehensive security scan...${NC}"
    
    # Install required tools
    # install_security_tools
    
    # Run security scans
    scan_dockerfile
    echo
    
    scan_npm_dependencies
    echo
    
    # scan_image_trivy
    # echo
    
    # scan_image_scout
    # echo
    
    check_security_configs
    echo
    
    scan_secrets
    echo
    
    # Generate comprehensive report
    generate_security_report
    
    echo -e "${GREEN}🎉 Security scan completed!${NC}"
    echo "Results saved in: ${SCAN_RESULTS_DIR}/"
    echo
    echo "Next steps:"
    echo "1. Review the security report"
    echo "2. Address any critical vulnerabilities"
    echo "3. Update dependencies regularly"
    echo "4. Monitor for new security advisories"
}

# Handle script arguments
case "${1:-scan}" in
    "scan")
        main
        ;;
    "dockerfile")
        scan_dockerfile
        ;;
    "npm")
        scan_npm_dependencies
        ;;
    "secrets")
        scan_secrets
        ;;
    "config")
        check_security_configs
        ;;
    "help")
        echo "Security Scanner for LLM Service"
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  scan        Run full security scan (default)"
        echo "  dockerfile  Scan Dockerfile only"
        echo "  npm         Scan npm dependencies only"
        echo "  secrets     Scan for exposed secrets"
        echo "  config      Check security configurations"
        echo "  help        Show this help message"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac