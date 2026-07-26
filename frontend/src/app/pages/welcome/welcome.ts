import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { ThemeToggle } from '../../core/theme-toggle';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink, ThemeToggle],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss'
})
export class Welcome {
  auth = inject(Auth);

  // El año se calcula solo, para que el pie no quede desactualizado
  readonly year = new Date().getFullYear();
}
