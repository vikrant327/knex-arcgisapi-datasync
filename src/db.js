const knex = require('knex');

module.exports = function (config) {
    const db = knex({
        client: 'mssql',
        debug: true,
        connection: config.get('db'),
    });

    return db;
};
