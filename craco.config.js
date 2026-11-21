module.exports = {
	babel : {
		plugins : ["@babel/plugin-transform-optional-chaining"],
	},
	webpack : {
		configure(webpackConfig) {
			// Direct Webpack to properly parse modern .mjs files inside node_modules
			webpackConfig.module.rules.push({
				test    : /\.mjs$/,
				include : /node_modules/,
				type    : "javascript/auto",
			});
			return webpackConfig;
		},
		alias : {
			"../../theme.config$" : require("path").join(__dirname, "/src/semantic-ui/theme.config"),
		},
	},
	plugins : [
		{
			plugin : require("@semantic-ui-react/craco-less"),
		},
	],
	eslint : {
		enable : false,
	},
};
