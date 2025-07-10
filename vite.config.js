import basicSsl from '@vitejs/plugin-basic-ssl';

export default {
	base: '/shifter/',
	plugins: [basicSsl()],
	server: {
		https: true,
		host: true,
	},
};
