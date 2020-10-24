var path = require('path');

module.exports = {
    target: 'node',
    mode: 'production',
    entry: './src/index.js',
    output: {
        path: path.join(__dirname, 'build'),
        filename: 'main.js'
    },
    externals: {
        // Possible drivers for knex - we'll ignore them
        sqlite3: 'sqlite3',
        mysql2: 'mysql2',
        mariasql: 'mariasql',
        mysql: 'mysql',
        oracle: 'oracle',
        'strong-oracle': 'strong-oracle',
        oracledb: 'oracledb',
        pg: 'pg',
        'pg-query-stream': 'pg-query-stream'
    }
};
