import { defineConfig } from 'vite';

// Сайт публикуется на GitHub Pages как проектная страница
// (https://dll-chief.github.io/3D2SIRD/), а не в корне домена — без base
// пути к собранным ассетам будут вести на несуществующий /assets/... в
// корне и страница окажется пустой.
export default defineConfig({
  base: '/3D2SIRD/',
});
