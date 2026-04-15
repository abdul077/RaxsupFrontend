import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { AuthService } from '../../../core/services/auth';
import { UserProfile, UpdateUserProfileRequest } from '../../../core/models/user-profile.model';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.scss'
})
export class MyProfileComponent implements OnInit {
  profile: UserProfile | null = null;
  profileForm!: FormGroup;
  loading = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;
  editing = false;
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  constructor(
    private profileService: UserProfileService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  initializeForm(): void {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }], // Email is typically not editable
      phoneNumber: [''],
      address: [''],
      city: [''],
      state: [''],
      zipCode: ['']
    });
  }

  loadProfile(): void {
    this.loading = true;
    this.error = null;
    
    this.profileService.getUserProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.populateForm(profile);
        this.loading = false;
      },
      error: (err) => {
        // If API endpoint doesn't exist yet, use current user from auth service
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          this.profile = {
            userId: currentUser.userId,
            username: currentUser.username,
            email: currentUser.email,
            fullName: currentUser.fullName,
            role: currentUser.role
          };
          this.populateForm(this.profile);
        }
        this.loading = false;
        this.error = err.error?.message || 'Failed to load profile';
      }
    });
  }

  populateForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      fullName: profile.fullName || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || '',
      address: profile.address || '',
      city: profile.city || '',
      state: profile.state || '',
      zipCode: profile.zipCode || ''
    });
  }

  toggleEdit(): void {
    this.editing = !this.editing;
    if (!this.editing) {
      // Reset form if canceling
      if (this.profile) {
        this.populateForm(this.profile);
      }
      this.error = null;
      this.success = null;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.error = 'Please select an image file';
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.error = 'File size must be less than 5MB';
        return;
      }
      
      this.selectedFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  uploadPhoto(): void {
    if (!this.selectedFile) return;
    
    this.saving = true;
    this.error = null;
    
    this.profileService.uploadProfilePhoto(this.selectedFile).subscribe({
      next: (response) => {
        if (this.profile) {
          this.profile.profilePhotoUrl = response.photoUrl;
        }
        this.success = 'Profile photo uploaded successfully';
        this.selectedFile = null;
        this.previewUrl = null;
        this.saving = false;
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to upload photo';
        this.saving = false;
      }
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.saving = true;
    this.error = null;
    this.success = null;

    const updateData: UpdateUserProfileRequest = {
      fullName: this.profileForm.value.fullName,
      phoneNumber: this.profileForm.value.phoneNumber,
      address: this.profileForm.value.address,
      city: this.profileForm.value.city,
      state: this.profileForm.value.state,
      zipCode: this.profileForm.value.zipCode
    };

    this.profileService.updateUserProfile(updateData).subscribe({
      next: (response) => {
        this.success = response.message || 'Profile updated successfully';
        this.editing = false;
        this.loadProfile(); // Reload to get updated data
        this.saving = false;
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update profile';
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

  getRoleDisplayName(role: string | undefined): string {
    if (!role) return 'User';
    return role
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

