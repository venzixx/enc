export default {
	color: {
		red: 0xff0000,
		green: 0x00ff00,
		blue: 0x0000ff,
		yellow: 0xffff00,
		main: 0xFFFFFF,
	},
	// You can add custom emoji with ID format (e.g., <:emojiName:123456789012345678>)
	emoji: {
		pause: "⏸️",
		resume: "▶️",
		stop: "⏹️",
		skip: "⏭️",
		previous: "⏮️",
		forward: "⏩",
		rewind: "⏪",
		volume: {
			down: "🔉",
			up: "🔊",
		},
		shuffle: "🔀",
		loop: {
			none: "🔁",
			track: "🔂",
		},
		page: {
			last: "⏩",
			first: "⏪",
			back: "⬅️",
			next: "➡️",
			cancel: "⏹️",
		},
	},
	icons: {
		youtube: "https://i.imgur.com/xzVHhFY.png",
		spotify: "https://i.imgur.com/qvdqtsc.png",
		soundcloud: "https://i.imgur.com/MVnJ7mj.png",
		applemusic: "https://i.imgur.com/Wi0oyYm.png",
		deezer: "https://i.imgur.com/xyZ43FG.png",
		jiosaavn: "https://i.imgur.com/N9Nt80h.png",
	} as any,
	links: {
		img: "https://i.imgur.com/ud3EWNh.jpg",
	},
    prefix: process.env.PREFIX || "e!",
    nodes: process.env.NODES ? JSON.parse(process.env.NODES) : [
        {
            id: "Local",
            host: process.env.LAVALINK_HOST || "localhost",
            port: Number.parseInt(process.env.LAVALINK_PORT || "2333"),
            password: process.env.LAVALINK_PASSWORD || (process.env.LAVALINK_PASS ? process.env.LAVALINK_PASS.trim() : "youshallnotpass"),
            secure: process.env.LAVALINK_SECURE === "true",
        }
    ],
};
