import { BaseController } from './BaseController';
import { Request, Response } from 'express';
import { TOKENS } from '../di/tokens';

export class AuthController extends BaseController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      const storage = this.resolve(TOKENS.DatabaseService);

      const user = await storage.authenticateUser(username, password);
      if (!user) {
        this.sendError(res, 401, "Invalid credentials");
        return;
      }

      // SECURITY FIX: Regenerate session ID to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          this.sendError(res, 500, "Session error");
          return;
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role || 'user';
        
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            this.sendError(res, 500, "Session error");
            return;
          }

          this.sendSuccess(res, {
            user: { 
              id: user.id, 
              username: user.username,
              role: user.role || 'user'
            }
          }, "Login successful");
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      this.handleError(error, res);
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      const storage = this.resolve(TOKENS.DatabaseService);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        this.sendError(res, 409, "Username already exists");
        return;
      }
      
      // Create new user with hashed password (hashing is done in storage layer)
      const newUser = await storage.createUser({ username, password });
      
      // Log successful registration
      console.log(`New user registered: ${username} from IP: ${req.ip}`);
      
      // Automatically log in the new user with session regeneration for security
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error after registration:', err);
          this.sendError(res, 500, "Session creation failed after registration");
          return;
        }

        req.session.userId = newUser.id;
        req.session.username = newUser.username;
        req.session.role = 'user'; // Set role for consistency
        
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error after registration:', saveErr);
            this.sendError(res, 500, "Session save failed after registration");
            return;
          }
          
          this.sendSuccess(res, {
            user: { 
              id: newUser.id, 
              username: newUser.username,
              role: 'user'
            }
          }, "Registration successful");
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      this.handleError(error, res);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    const userId = req.session?.userId;
    const username = req.session?.username;
    
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        this.sendError(res, 500, "Logout failed");
        return;
      }
      
      // Clear session cookie
      res.clearCookie('connect.sid');
      
      // Log successful logout
      if (userId && username) {
        console.log(`User ${username} (ID: ${userId}) logged out from IP: ${req.ip}`);
      }
      
      this.sendSuccess(res, null, "Logout successful");
    });
  }

  async getAuthStatus(req: Request, res: Response): Promise<void> {
    if (req.session && req.session.userId) {
      this.sendSuccess(res, {
        authenticated: true,
        user: { id: req.session.userId, username: req.session.username }
      });
    } else {
      this.sendSuccess(res, { authenticated: false });
    }
  }
}