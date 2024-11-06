module.exports = {
    entry: {
        client: './src/client.js',
        server: './src/server.js',
    },
    output: {
        filename: '[name].js',
        path: __dirname + '/dist/',
    }
};
