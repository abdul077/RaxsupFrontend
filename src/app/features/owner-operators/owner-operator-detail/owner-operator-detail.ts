import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { AuthService } from '../../../core/services/auth';
import { OwnerOperatorDetail } from '../../../core/models/driver.model';

@Component({
  selector: 'app-owner-operator-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owner-operator-detail.html',
  styleUrl: './owner-operator-detail.scss',
})
export class OwnerOperatorDetailComponent implements OnInit {
  ownerOperator: OwnerOperatorDetail | null = null;
  loading = true;

  constructor(
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOwnerOperator(+id);
    } else {
      this.router.navigate(['/owner-operators']);
    }
  }

  loadOwnerOperator(id: number): void {
    this.loading = true;
    this.driverService.getOwnerOperatorById(id).subscribe({
      next: (data) => {
        this.ownerOperator = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        alert('Failed to load owner operator');
        this.router.navigate(['/owner-operators']);
      }
    });
  }

  edit(): void {
    if (this.ownerOperator) {
      this.router.navigate(['/owner-operators', this.ownerOperator.ownerOperatorId, 'edit']);
    }
  }

  goBack(): void {
    this.router.navigate(['/owner-operators']);
  }

  viewDriver(driverId: number): void {
    this.router.navigate(['/drivers', driverId]);
  }
}

