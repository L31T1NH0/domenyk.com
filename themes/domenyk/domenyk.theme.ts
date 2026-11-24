// The domenyk theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in domenyk.settings.json and the generated domenyk.settings.ts;
// change them with `astryx experimental theme editor set domenyk ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {domenykSettings} from './domenyk.settings';

export const domenykTheme = defineTheme({
  extends: domenykSettings,
  name: 'domenyk',
  tokens: {
    '--color-background-surface': ['#ffffff', '#0b0b0b'],
    '--color-background-card': ['#ffffff', '#101010'],
    '--color-background-muted': ['#f5f5f5', '#161616'],
    '--color-background-popover': ['#ffffff', '#141414'],
    '--color-border': ['#dedede', '#2b2b2b'],
    '--color-text-secondary': ['#606060', '#a8a8a8'],
    '--color-accent-muted': ['#fce6f0', '#2b101e'],
  },
  components: {
    'app-shell-sidenav': {base: {backgroundColor: 'var(--color-background-body)'}},
    'layout-content': {base: {backgroundColor: 'var(--color-background-body)'}},
    section: {base: {
      backgroundColor: 'var(--color-background-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-container)',
      padding: 'var(--spacing-6)',
    }},
    'side-nav-item': {selected: {
      backgroundColor: 'var(--color-accent-muted)',
      color: 'var(--color-text-primary)',
      fontWeight: 'var(--font-weight-semibold)',
    }},
    'progress-bar-fill': {base: {backgroundColor: 'light-dark(#b30058, #ef7ab5)'}},
  },
});
