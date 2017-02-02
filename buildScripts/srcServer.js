import express from 'express';
import path from 'path';
import open from 'open';
import chalk from 'chalk';
import webpack from 'webpack';
import config from '../webpack.config';

/* eslint-disable no-console */

const port = 3000;
const app = express();

const compiler = webpack(config);

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo: true,
  publicPath: config.output.publicPath
}));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.get('/users', (req, res) => {
  // Hard coding for simplicity. Pretend this hits a real database
  res.json([
    { "id": 1, "firstName": "Mark", "lastName": "Hamill", "email": "mhamill@starwars.com" },
    { "id": 2, "firstName": "Harrison", "lastName": "Ford", "email": "hford@starwars.com" },
    { "id": 3, "firstName": "Carrie", "lastName": "Fisher", "email": "cfisher@starwars.com" }
  ]);
});

app.listen(port, err => {
  if (err) {
    console.log(chalk.red('Error in starting dev server'), err);
  } else {
    console.log(chalk.green('Starting app in dev mode'));
    open('http://localhost:' + port);
  }
});
