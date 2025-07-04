#!/bin/bash

# Cloudflare Pages Deployment Script for TelemetryDatabase
# This script sets up and deploys the biometric telemetry application

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

function log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function log_error() {
    echo -e "${RED}❌ $1${NC}"
}

function check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI not found. Please install it first:"
        echo "npm install -g wrangler"
        exit 1
    fi
    log_success "Wrangler CLI found"
}

function check_auth() {
    if ! wrangler whoami &> /dev/null; then
        log_warning "Not authenticated with Cloudflare"
        log_info "Please run: wrangler login"
        exit 1
    fi
    log_success "Authenticated with Cloudflare"
}

function deploy_preview() {
    log_info "🚀 Deploying to PREVIEW environment..."
    
    # Build the application
    log_info "Building application..."
    npm run build
    
    # Deploy to preview
    log_info "Deploying to Cloudflare Pages (preview)..."
    wrangler pages deploy dist/public --project-name=biometric-telemetry --env=preview
    
    log_success "Preview deployment complete!"
    log_info "Your preview site should be available at:"
    echo "https://biometric-telemetry-preview.pages.dev"
}

function deploy_production() {
    log_info "🚀 Deploying to PRODUCTION environment..."
    
    # Validate environment first
    log_info "Validating production environment..."
    if ! npm run validate:env; then
        log_error "Environment validation failed. Please fix errors before production deployment."
        exit 1
    fi
    
    # Build the application
    log_info "Building application..."
    npm run build
    
    # Deploy to production
    log_info "Deploying to Cloudflare Pages (production)..."
    wrangler pages deploy dist/public --project-name=biometric-telemetry --env=production
    
    log_success "Production deployment complete!"
    log_info "Your production site should be available at:"
    echo "https://biometric-telemetry.pages.dev"
}

function setup_secrets() {
    local ENV=$1
    log_info "🔐 Setting up secrets for $ENV environment..."
    
    echo ""
    log_warning "You'll need to set these secrets manually using wrangler:"
    
    # Generate a new session secret
    log_info "Generating secure SESSION_SECRET..."
    SESSION_SECRET=$(node -e "
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#\$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';
    for(let i = 0; i < 128; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log(result);
    ")
    
    echo ""
    echo "Copy and paste these commands:"
    echo ""
    echo -e "${GREEN}# Session Secret${NC}"
    echo "echo \"$SESSION_SECRET\" | wrangler secret put SESSION_SECRET --env $ENV"
    echo ""
    echo -e "${GREEN}# Weaviate Configuration${NC}"
    echo "wrangler secret put WEAVIATE_URL --env $ENV"
    echo "wrangler secret put WEAVIATE_API_KEY --env $ENV"
    echo ""
    echo -e "${GREEN}# Admin Authentication${NC}"
    echo "wrangler secret put PROMPT_USERNAME --env $ENV"
    echo "wrangler secret put PROMPT_PASSWORD --env $ENV"
    echo ""
    
    if [ "$ENV" = "production" ]; then
        echo -e "${GREEN}# OAuth (recommended for production)${NC}"
        echo "wrangler secret put ADMIN_OAUTH_CLIENT_ID --env $ENV"
        echo "wrangler secret put ADMIN_OAUTH_CLIENT_SECRET --env $ENV"
        echo ""
    fi
    
    echo -e "${YELLOW}When prompted, enter the values for each secret.${NC}"
    echo -e "${YELLOW}For WEAVIATE_URL, use: https://your-cluster.weaviate.cloud${NC}"
    echo ""
}

# Main deployment logic
case "$1" in
    "preview"|"staging")
        check_wrangler
        check_auth
        deploy_preview
        ;;
    "production"|"prod")
        check_wrangler
        check_auth
        deploy_production
        ;;
    "secrets-preview")
        check_wrangler
        check_auth
        setup_secrets "preview"
        ;;
    "secrets-production")
        check_wrangler
        check_auth
        setup_secrets "production"
        ;;
    "setup")
        log_info "🛠️  Setting up Cloudflare deployment..."
        check_wrangler
        check_auth
        
        log_info "Setting up secrets for preview environment..."
        setup_secrets "preview"
        
        read -p "Press Enter after setting preview secrets to continue..."
        
        log_info "Setting up secrets for production environment..."
        setup_secrets "production"
        
        read -p "Press Enter after setting production secrets to continue..."
        
        log_info "Ready to deploy! Use:"
        echo "  ./scripts/deploy-cloudflare.sh preview    # Deploy to staging"
        echo "  ./scripts/deploy-cloudflare.sh production # Deploy to production"
        ;;
    *)
        echo "Usage: $0 {preview|production|secrets-preview|secrets-production|setup}"
        echo ""
        echo "Commands:"
        echo "  preview           Deploy to preview/staging environment"
        echo "  production        Deploy to production environment"
        echo "  secrets-preview   Set up secrets for preview environment"
        echo "  secrets-production Set up secrets for production environment"
        echo "  setup             Interactive setup of secrets and deployment"
        echo ""
        echo "Examples:"
        echo "  $0 setup          # First-time setup"
        echo "  $0 preview        # Deploy to staging"
        echo "  $0 production     # Deploy to production"
        exit 1
        ;;
esac