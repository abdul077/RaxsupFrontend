import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { GlobalSearchResult } from '../models/global-search.model';

@Injectable({
  providedIn: 'root',
})
export class GlobalSearchService {
  constructor(private apiService: ApiService) {}

  search(query: string, limit: number = 8): Observable<GlobalSearchResult> {
    return this.apiService.get<GlobalSearchResult>(
      'search',
      { q: query, limit },
      { 'X-Skip-Loading': 'true' }
    );
  }
}
