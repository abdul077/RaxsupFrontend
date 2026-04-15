import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-help-support',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './help-support.html',
  styleUrl: './help-support.scss'
})
export class HelpSupportComponent {
  faqs = [
    {
      question: 'How do I update my profile information?',
      answer: 'Navigate to My Profile from the top menu, click the Edit button, make your changes, and click Save Changes.'
    },
    {
      question: 'How do I change my password?',
      answer: 'Go to Settings from the top menu, select the Account tab, enter your current password and new password, then click Change Password.'
    },
    {
      question: 'How do I manage notifications?',
      answer: 'Go to Settings, select the Notifications tab, and toggle your preferred notification methods (Email, Push, SMS).'
    },
    {
      question: 'How do I contact support?',
      answer: 'You can contact our support team via email at support@raxup.com or by phone at 1-800-RAX-UP1. Support hours are Monday-Friday, 8 AM - 6 PM EST.'
    },
    {
      question: 'How do I upload documents?',
      answer: 'Navigate to the appropriate section (e.g., Drivers > Documents), click Upload Document, select your file, and fill in the required information.'
    },
    {
      question: 'How do I view my load assignments?',
      answer: 'Go to the Loads section from the main navigation menu. You can filter and search for your assigned loads.'
    }
  ];

  expandedFaq: number | null = null;

  toggleFaq(index: number): void {
    this.expandedFaq = this.expandedFaq === index ? null : index;
  }

  supportEmail = 'support@raxup.com';
  supportPhone = '1-800-RAX-UP1';
  supportHours = 'Monday - Friday, 8:00 AM - 6:00 PM EST';
}

