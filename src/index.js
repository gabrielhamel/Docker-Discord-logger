const Docker = require('dockerode');
const docker = new Docker();
const Discord = require('discord.js');
const getenv = require('getenv');
const client = new Discord.Client();
const dotenv = require('dotenv');

// Load env
dotenv.config();

let guildLog = null;
let channelLog = null;

let logsList = new Array();

function createLogFile(logs) {
    const buffer = Buffer.from(logs);
    const file = new Discord.MessageAttachment(buffer, 'logs.txt');
    return file;
}

// When a container emmits log
function onLog(containerInfo, logs) {
    // Insert log into list
    logsList.push(logs);
    if (logsList.length > getenv('LOGS_LINE_NB')) {
        logsList = logsList.slice(1);
    }
    const concatedLogs = logsList.join('\n');
    const containerName = containerInfo.Names.map(name => '`' + name + '`').join(', ');
    let message = ':x: **Error on ' +
                    getenv('APP_NAME') + '**\n\n:ballot_box: __Containers__: ' + containerName +
                    '\n\n:pen_ballpoint: __Logs__:```' + '```\n:printer: __File__:';
    message = message.replace('``````', '```' + concatedLogs.slice(concatedLogs.length - 2000 + message.length) + '```');
    channelLog.send(message, createLogFile(concatedLogs))
    .catch(err => {
       console.log(`Unable to write in ${channelLog.name} ! ${err.message}`);
    });
}

// Bind stream of a container
function bindContainer(containerInfo) {
    console.log('Binding "' + containerInfo.Names.join(', ') + '" container');
    const container = docker.getContainer(containerInfo.Id);
    container.attach({
        stream: true,
        stdout: true,
        stderr: true
    }, (err, stream) => {
        if (err) {
            return console.error(err);
        }
        stream.on('data', chunk =>
            onLog(containerInfo, chunk.toString('utf8'))
        );
    });
}

// Pull containers info list
function getContainers() {
    const filters = JSON.parse(getenv('DOCKER_CONTAINERS'));
    return new Promise(resolve => {
        docker.listContainers()
        .then(containers => {
            resolve(
                containers.filter(container =>
                    container.Names.filter(name =>
                        filters.filter(filter =>
                            name.match(filter)
                        ).length
                    ).length
                )
            );
        })
        .catch(err => console.error(err));
    });
}

// Wait discord connection
client.on('ready', () => {
    client.guilds.cache.forEach(guild => {
        if (guild.id !== getenv('DISCORD_SERVER_ID')) {
            return
        }
        guildLog = guild;
        guild.channels.cache.forEach(channel => {
            if (channel.id === getenv('DISCORD_CHANNEL_ID')) {
                channelLog = channel;
            }
        });
    });
    if (guildLog === null) {
        console.error('Unable to find the discord server specified in environment');
    } else if (guildLog && channelLog === null) {
        console.error('Unable to find the discord channel specified in environment');
    } else if (channelLog.type !== "text") {
        console.error('This channel isn\'t a text channel');
    } else {
        getContainers()
        .then(containersInfo => containersInfo.forEach(containerInfo => bindContainer(containerInfo)))
        .catch(err => console.error(err));
    }
});

client.login(getenv('DISCORD_CLIENT_TOKEN'));
