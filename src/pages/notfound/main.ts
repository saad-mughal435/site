/* =========================================================
   404 page entry (replaces the styles.css <link> only).
   Deliberately does NOT import lib/shell: the 404 page never
   loaded script.js - its inline head script wires the theme
   toggle via document-level delegation, and adding the shell's
   per-button listener on top would toggle twice per click.
   ========================================================= */

import '../../styles/shell.css';
