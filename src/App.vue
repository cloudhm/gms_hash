<template>
  <router-view />
</template>

<style>
body {
  font-family: sans-serif;
  max-width: 880px;
  margin: 2rem auto;
  padding: 0 1rem;
  color: #222;
}
input, button, textarea { font: inherit; }
input[type='password'], input[type='text'] {
  width: 100%;
  padding: 6px 8px;
  box-sizing: border-box;
}
label { display: block; margin: 8px 0 4px; font-size: 13px; }
table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
  vertical-align: top;
  font-size: 13px;
  word-break: break-all;
}
th { background: #f5f5f5; }
.row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.err { color: #b00020; }
.ok { color: #0a7; }
.card {
  border: 1px solid #ddd;
  padding: 12px 14px;
  border-radius: 8px;
  margin: 12px 0;
}
button.danger { color: #b00020; }
code { font-size: 12px; }
a { color: inherit; }
</style>
