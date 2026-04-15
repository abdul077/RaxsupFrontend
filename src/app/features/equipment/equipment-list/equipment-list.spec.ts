import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EquipmentList } from './equipment-list';

describe('EquipmentList', () => {
  let component: EquipmentList;
  let fixture: ComponentFixture<EquipmentList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EquipmentList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
