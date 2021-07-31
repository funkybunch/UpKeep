module.exports = {
    publicPath: './',
    chainWebpack: (config) => {
        config
            .plugin('html')
            .tap(args => {
                args[0].title = process.env.TITLE;
                args[0].logo = process.env.LOGO_FILE_NAME;
                args[0].meta = {viewport: 'width=device-width,initial-scale=1,user-scalable=no'};

                return args;
            })
    }
}