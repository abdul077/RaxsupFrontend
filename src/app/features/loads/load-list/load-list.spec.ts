import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadList } from './load-list';

describe('LoadList', () => {
  let component: LoadList;
  let fixture: ComponentFixture<LoadList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
