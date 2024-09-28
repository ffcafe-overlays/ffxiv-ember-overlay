module.exports = {
	babel : {
		plugins : ["@babel/plugin-transform-optional-chaining"],
	},
	webpack : {
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
