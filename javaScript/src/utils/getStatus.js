const { ActivityType } = require('discord.js');

const status = [
    {
        name: 'Losing my shit',
        type: ActivityType.Playing,
        url: 'https://www.twitch.tv/your_channel'
    },
    {
        name: 'Chilling out',
        type: ActivityType.Listening,
    },
    {
        name: 'Playing some games',
        type: ActivityType.Playing,
    }
];

const twitch = 'https://api.twitch.tv/helix/streams';

module.exports = { status };