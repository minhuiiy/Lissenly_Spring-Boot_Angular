import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-svg-icon-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './svg-icon-button.component.html',
  styleUrls: ['./svg-icon-button.component.css']
})
export class SvgIconButtonComponent {
  @Input() label = '';
  @Input() iconPath = '';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  @Input() disabled = false;
}
