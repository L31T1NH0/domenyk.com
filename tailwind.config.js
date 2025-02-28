/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // or 'media' or 'class'
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: "#040404",
        primary: "#E8E6E3",
        secondary: "#A8A095",
        link: "#3AA4FF",
      },
    },
  },
  variants: {
    extend: {},
  },
};
