import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, RegisterDriverRequest } from '../../../core/services/auth';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  isBeta = environment.isBeta;
  appVersion = environment.appVersion;
  loginForm: FormGroup;
  registerForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  showRegisterForm = false;
  referralDriverId?: number;
  returnUrl: string = '/dashboard';
  showPassword: boolean = false;
  showRegisterPassword: boolean = false;
  showRegisterConfirmPassword: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      usernameOrEmail: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required]],
      phoneNumber: [''],
      referralCode: [''] // Manual referral code input
    }, { validators: this.passwordMatchValidator });

    // Check for query parameters in URL
    this.route.queryParams.subscribe(params => {
      if (params['ref']) {
        this.referralDriverId = +params['ref'];
        this.registerForm.patchValue({ referralCode: params['ref'] });
        this.showRegisterForm = true;
      }
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword) {
      confirmPassword.setErrors(null);
    }
    return null;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.errorMessage = '';
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          // Additional check: verify email is verified (backend should prevent this, but double-check)
          if (response && !response.emailVerified) {
            this.errorMessage = 'Your email address has not been verified. Please check your email and click the verification link before logging in.';
            this.authService.logout(); // Clear any stored token
            return;
          }
          // Navigate to returnUrl if provided, otherwise default to dashboard
          this.router.navigateByUrl(this.returnUrl);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Login failed. Please check your credentials.';
        }
      });
    }
  }

  toggleRegisterForm(): void {
    this.showRegisterForm = !this.showRegisterForm;
    this.errorMessage = '';
    this.successMessage = '';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleRegisterPasswordVisibility(): void {
    this.showRegisterPassword = !this.showRegisterPassword;
  }

  toggleRegisterConfirmPasswordVisibility(): void {
    this.showRegisterConfirmPassword = !this.showRegisterConfirmPassword;
  }

  onRegister(): void {
    if (this.registerForm.valid) {
      this.errorMessage = '';
      this.successMessage = '';

      // Parse referral code (can be DriverId from URL or manual entry)
      let referredByDriverId: number | undefined = undefined;
      const referralCode = this.registerForm.value.referralCode?.trim();
      if (referralCode) {
        const parsedId = parseInt(referralCode, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
          referredByDriverId = parsedId;
        } else {
          this.errorMessage = 'Invalid referral code. Please enter a valid driver ID.';
          return;
        }
      }

      const registrationData: RegisterDriverRequest = {
        username: this.registerForm.value.username,
        password: this.registerForm.value.password,
        email: this.registerForm.value.email,
        fullName: this.registerForm.value.fullName,
        phoneNumber: this.registerForm.value.phoneNumber || undefined,
        referredByDriverId: referredByDriverId
      };

      this.authService.registerDriver(registrationData).subscribe({
        next: (response) => {
          // Check if email was sent successfully
          if (response.emailSent) {
            this.successMessage = response.message;
            this.errorMessage = '';
          } else {
            // Registration succeeded but email failed
            this.successMessage = 'Registration successful! Your account has been created.';
            if (response.emailError) {
              this.errorMessage = `⚠️ ${response.emailError}`;
            } else {
              this.errorMessage = '⚠️ Registration completed, but the confirmation email could not be sent. Please contact support if you do not receive the email.';
            }
          }
          this.registerForm.reset();
          // Optionally switch back to login form after 5 seconds if email was sent, otherwise keep form open longer
          const timeout = response.emailSent ? 5000 : 8000;
          setTimeout(() => {
            if (response.emailSent) {
              this.showRegisterForm = false;
              this.successMessage = '';
            }
            this.errorMessage = '';
          }, timeout);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Registration failed. Please try again.';
          this.successMessage = '';
        }
      });
    }
  }
}
