const express = require('express');

const path = require('path');

const mysql = require('mysql');

const http = require("http");

const PORT = process.env.PORT || 5000;

const core = require('./core/app');

express()
    .use(express.static(path.join(__dirname, 'src')))
    .set('views', path.join(__dirname, 'src/views'))
    .set('view engine', 'ejs')
    .get('/', (req, res) => res.render('index', {users: core.stats() }))
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

core.run();

setInterval(function () {
    http.get("http://beem-marketing.herokuapp.com");
}, 240000);
