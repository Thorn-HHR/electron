 module.exports = {
    // if true, log all actions to console instead of just join/part sessions
    verbose: true,

    // Feature flags.  Set any one to false to disable it.
    features: {
        promode: true
    },

    // A list of cam URLs for the driver to select.
    camUrlList: [
        { name: 'eStimStation Stimroom', url: 'https://discord.com/channels/786142403987505182/130951>
        { name: 'eStimStation Hangout', url: 'https://discord.com/channels/786142403987505182/1124800>
        { name: 'Ask your driver', message: 'Ask your driver' }
    ],

    // This enables the playlist/jukebox feature.
    playlistSession: {
        sessId: 'jukeboxbot', // Must be 10 characters exactly
        directory: './session_files',
        public: true,
        driverName: 'Jukebox Driver',
        driverComments: 'Playing the greatest hits 24/7',
        camUrl: 'eStimStation Stimroom',
        channels: ['left', 'right', 'bottle']
    },

    // This includes your custom footnotes at the bottom of the page.
    indexFootnotesFile: 'footnotes.html',

    // This sets your custom bottle image.
    bottleImage: 'bottle-ess.png',
};
