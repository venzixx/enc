export default {
	color: {
		red: 0xef4444, // Modern sleek red
		green: 0x22c55e, // Modern sleek green
		blue: 0x3b82f6, // Modern sleek blue
		yellow: 0xeab308, // Modern sleek yellow
		orange: 0xf97316, // Modern sleek orange
		main: 0xFFFFFF,
	},
	// High-Fidelity Custom Emoji Manifest
	emoji: {
        success: "<:success:1494693113216634880>",
        cross: "<:cross:1494693110553509939>",
        exclamation: "<:exclamation:1494693108653228042>",
        info: "<:info:1494693106132586718>",
        hammer: "<:hammer:1494693090336833746>",
        shield: "<:shield:1494693081814143066>",
        user: "<:user:1494693083923877979>",
        remove_user: "<:remove_user:1494693093260132463>",
        edit: "<:edit:1494693086843109527>",
        clock: "<:clock:1494693103624388769>",
        play: "<:play:1494693126772625542>",
        pause: "<:pause:1494693129281081555>",
        resume: "<:play:1494693126772625542>",
        stop: "<:cross:1494693110553509939>", 
        next: "<:next:1494693118405120090>",
        previous: "<:previous:1494693121336934450>",
        rewind: "<:previous:1494693121336934450>",
        forward: "<:next:1494693118405120090>",
        shuffle: "<:shuffle:1494693123765440623>",
        loop: "<:loop:1494693115569897583>",
        music: "<:musicnote:1494693131730288831>",
        voldown: "<:voldown:1494693077619576832>",
        volmore: "<:volmore:1494693075128160427>",
        random: "<:random:1494693101279907940>",
        swords: "<:swords:1494693079737696458>",
        ecr: "<:ecr:1494693072930476062>",
        cat: "<:cat:1494693070661484636>",
        mic: "<:mic:1494693098901475408>",
        micclose: "<:micclose:1494693098545217536>",
        rank: "<:user:1494693083923877979>",
        link: "<:ecr:1494693072930476062>",
		page: {
			last: "<:next:1494693118405120090>",
			first: "<:previous:1494693121336934450>",
			back: "<:previous:1494693121336934450>",
			next: "<:next:1494693118405120090>",
			cancel: "<:cross:1494693110553509939>",
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
