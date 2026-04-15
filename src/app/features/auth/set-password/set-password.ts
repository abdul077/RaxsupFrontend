import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './set-password.html',
  styleUrl: './set-password.scss',
})
export class SetPasswordComponent implements OnInit {
  isBeta = environment.isBeta;
  setPasswordForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  token: string = '';
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.setPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Check if we're on the verify-email route by checking the route path
    const routePath = this.route.snapshot.routeConfig?.path || '';
    const isVerifyEmailRoute = routePath === 'verify-email';
    
    // Get token from query parameter
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.errorMessage = 'Invalid verification link. Please check your email and try again.';
        return;
      }

      // If on verify-email route, verify the email first and get password setup token
      if (isVerifyEmailRoute) {
        this.verifyEmailAndGetPasswordToken();
      }
    });
  }

  verifyEmailAndGetPasswordToken(): void {
    if (!this.token) {
      this.errorMessage = 'Invalid verification link. Please check your email and try again.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = 'Verifying your email...';

    this.authService.verifyEmail(this.token).subscribe({
      next: (response) => {
        this.loading = false;
        
        if (response.success && response.passwordSetupToken) {
          // Redirect to set-password with the password setup token
          this.router.navigate(['/auth/set-password'], {
            queryParams: { token: response.passwordSetupToken }
          });
        } else if (response.redirectUrl) {
          // If redirectUrl is provided, use it (though this shouldn't happen in SPA)
          window.location.href = response.redirectUrl;
        } else {
          this.errorMessage = response.message || 'Email verification failed. Please try again.';
        }
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Failed to verify email. Please check your link and try again.';
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword && confirmPassword.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }
    return null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit(): void {
    if (this.setPasswordForm.valid && this.token) {
      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const formValue = this.setPasswordForm.value;
      this.authService.setPassword(this.token, formValue.password, formValue.confirmPassword).subscribe({
        next: (response) => {
          this.loading = false;
          this.successMessage = response.message || 'Password set successfully! Redirecting to login...';
          
          // Redirect to login after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/auth/login'], { 
              queryParams: { 
                message: 'Password set successfully. Please log in with your new password.' 
              } 
            });
          }, 2000);
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error.error?.message || 'Failed to set password. Please try again.';
        }
      });
    } else if (!this.token) {
      this.errorMessage = 'Invalid verification link. Please check your email and try again.';
    }
  }
}
