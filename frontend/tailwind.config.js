/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        coffee: "#6f4e37",
        leaf: "#3f7d58",
        clay: "#b86f52",
        cream: "#f6f1ea",
      },
    },
  },
  plugins: [],
};
