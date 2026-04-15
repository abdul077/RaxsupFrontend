import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-ref-redirect',
  standalone: true,
  template: '<p class="p-3">Redirecting...</p>',
})
export class RefRedirectComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const refId = this.route.snapshot.paramMap.get('refId');
    this.router.navigate(['/auth/login'], {
      queryParams: refId ? { ref: refId } : {},
      replaceUrl: true
    });
  }
}
