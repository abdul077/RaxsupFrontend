import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { UserPreferences, ChangePasswordRequest } from '../../../core/models/user-profile.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  preferencesForm!: FormGroup;
  passwordForm!: FormGroup;
  loading = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;
  activeTab: 'account' | 'notifications' | 'preferences' = 'account';

  constructor(
    private profileService: UserProfileService,
    private fb: FormBuilder
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadPreferences();
  }

  initializeForms(): void {
    this.preferencesForm = this.fb.group({
      emailNotifications: [true],
      pushNotifications: [true],
      smsNotifications: [false],
      theme: ['light'],
      language: ['en'],
      timezone: ['']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  loadPreferences(): void {
    this.loading = true;
    this.error = null;
    
    this.profileService.getUserPreferences().subscribe({
      next: (preferences) => {
        this.preferencesForm.patchValue(preferences);
        this.loading = false;
      },
      error: (err) => {
        // If API doesn't exist, use defaults
        this.loading = false;
        // Don't show error for missing endpoint, just use defaults
      }
    });
  }

  setActiveTab(tab: 'account' | 'notifications' | 'preferences'): void {
    this.activeTab = tab;
    this.error = null;
    this.success = null;
  }

  savePreferences(): void {
    this.saving = true;
    this.error = null;
    this.success = null;

    const preferences: UserPreferences = {
      emailNotifications: this.preferencesForm.value.emailNotifications,
      pushNotifications: this.preferencesForm.value.pushNotifications,
      smsNotifications: this.preferencesForm.value.smsNotifications,
      theme: this.preferencesForm.value.theme,
      language: this.preferencesForm.value.language,
      timezone: this.preferencesForm.value.timezone
    };

    this.profileService.updateUserPreferences(preferences).subscribe({
      next: (response) => {
        this.success = response.message || 'Preferences saved successfully';
        this.saving = false;
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to save preferences';
        this.saving = false;
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    this.saving = true;
    this.error = null;
    this.success = null;

    const passwordData: ChangePasswordRequest = {
      currentPassword: this.passwordForm.value.currentPassword,
      newPassword: this.passwordForm.value.newPassword
    };

    this.profileService.changePassword(passwordData).subscribe({
      next: (response) => {
        this.success = response.message || 'Password changed successfully';
        this.passwordForm.reset();
        this.saving = false;
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to change password';
        this.saving = false;
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}

