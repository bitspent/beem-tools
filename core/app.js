const dhive = require('@hiveio/dhive');
const dsteem = require('dsteem');

const MSG = process.env.MSG;

const SRC_STEEM = 'STEEM';
const SRC_HIVE = 'HIVE';

const PROVIDER_HIVE = process.env.API_PROVIDER_HIVE;
const PROVIDER_STEEM = process.env.API_PROVIDER_STEEM;

const ENABLE_HIVE = process.env.ENABLE_HIVE;
const ENABLE_STEEM = process.env.ENABLE_STEEM;

const RSP_ACC = process.env.RSP_ACCOUNT;
const RSP_KEY = dsteem.PrivateKey.fromString(process.env.TOKEN);
const MAX_SEND = Number(process.env.MAX_SEND || 500);

let serving = { 'HIVE': false, 'STEEM': false };

let users = [];

function log(x, y) {
    if (y) console.log(x, y);
    else console.log(x);
}

function asyncResult(res, rej) {
    return (e, r) => {
        if (e) {
            rej(e);
        } else {
            res(r);
        }
    }
}

function replaceAll(str, find, replace) {
    return str.split(find).join(replace);
}

async function dbInsertAccount(account) {
    return new Promise((res, rej) => {
        db.query('insert into accounts set ?', account, asyncResult(res, rej));
    });
}

async function dbFindAccount(account) {
    return new Promise((res, rej) => {
        db.query(`select * from accounts where account = ?`, [account], asyncResult(res, rej));
    });
}

async function found(user) {
    try {
        let accounts = await dbFindAccount(user);
        if (accounts.length === 0)
            return false;
    } catch (e) {
        log(e);
    }
    return true;
}

process.on('uncaughtException', err => {
    console.error('There was an uncaught error', err);
});

async function follow(user, src) {
    try {

        const client = src == SRC_STEEM ? new dsteem.Client(PROVIDER_STEEM, {}) : new dhive.Client(PROVIDER_HIVE, {});
        const follower = src == SRC_STEEM ? process.env.FOLLOWER_STEEM : process.env.FOLLOWER_HIVE;
        const following = user;

        console.log({ follower: follower, following: following });

        let status = await client.call('follow_api', 'get_following', [
            follower,
            following,
            'blog',
            1,
        ]);

        console.log({ status: status });

        let type = null;

        if (status.length > 0 && status[0].following == following) {

            const json = JSON.stringify([
                'follow',
                {
                    follower: follower,
                    following: following,
                    what: ['blog'], //null value for unfollow, 'blog' for follow
                },
            ]);

            const data = {
                id: 'follow',
                json: json,
                required_auths: [],
                required_posting_auths: [follower],
            };

            const FOLLOWER_TOKEN = src == SRC_STEEM ? process.env.FOLLOWER_STEEM_TOKEN : process.env.FOLLOWER_HIVE_TOKEN;
            const FOLLOWER_KEY = dsteem.PrivateKey.fromString(FOLLOWER_TOKEN);

            client.broadcast.json(data, FOLLOWER_KEY).then(
                function (result) {
                    console.log('user follow result: ', following, result);
                },
                function (error) {
                    console.error('error following user', following, error);
                }
            );

        } else {
            console.log('already following', following);
        }

    } catch (e) {
        console.error('error while following user', following, error);
    }
}

async function sendMsg(user, msg, src) {
    try {
        const client = src == SRC_STEEM ? new dsteem.Client(PROVIDER_STEEM, {}) : new dhive.Client(PROVIDER_HIVE, {});

        if (process.env.DBG_TRANSFERS) console.log(`${src} TRF to ${user}`);

        client.broadcast.transfer({
            from: RSP_ACC,
            to: user,
            amount: '0.001 ' + src,
            memo: msg
        }, RSP_KEY).then((e, r) => console.log(e || r));
    } catch (e) {
        log(e);
    }
}

async function checkAndMsg(user, msg, src) {
    if (await found(user) === false) {
        try {
            users.push(user);
            await sendMsg(user, msg, src);
            await dbInsertAccount({
                account: user,
                modified: new Date()
            });
            log(`sent message for [${users.length}] ${user}`);
        } catch (e) {
            log(e);
        }
    } else {
        log(`already send message for ${user}`);
    }
}

async function serve(src) {

    if (serving[src] === true) {
        log('already serving...');
        return;
    }

    serving[src] = true;

    const client = src == SRC_STEEM ? new dsteem.Client(PROVIDER_STEEM) : new dhive.Client(PROVIDER_HIVE);
    const stream = client.blockchain.getBlockStream();

    let stop = false;

    stream.on('data', async (block) => {

        if (stop === true)
            return;

        console.log(`GOT ${src} block`);

        if (process.env.DBG_BLOCKS)
            console.log('got block', block);

        if (users.length > MAX_SEND) {
            console.log('limit reached!');
            return;
        }

        for (let i = 0; i < block.transactions.length; i++) {

            let type = block.transactions[i].operations[0][0];
            let data = block.transactions[i].operations[0][1];

            if (type == 'transfer' && data.to == RSP_ACC && data.from == RSP_ACC && data.memo == 'notify') {
                console.log('new marketing round');
                users = [];
            }

            if (users.length > MAX_SEND) {
                console.log('limit reached!');
                break;
            }

            if (type === 'comment' || type === 'post') {
                await checkAndMsg(data.author, MSG, src);
                await follow(data.author, src);
            }
        }
    });

    // reconnect
    stream.on('error', () => { stop = true; serving[src] = false; serve(src); console.log('reconnect...'); });
}

function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

Date.prototype.YYYYMMDDHHMMSS = function () {
    var yyyy = this.getFullYear().toString();
    var MM = pad(this.getMonth() + 1, 2);
    var dd = pad(this.getDate(), 2);
    var hh = pad(this.getHours(), 2);
    var mm = pad(this.getMinutes(), 2)
    var ss = pad(this.getSeconds(), 2)

    return yyyy + MM + dd + hh + mm + ss;
};

async function msgSubs() {

    let flagMS = Number(process.env.FLAG_YYYYMMDDHHMMSS);

    if (new Date().YYYYMMDDHHMMSS() < flagMS) {

        log('flag active, sending memos');

        let users = process.env.MEMO_USERS;
        let memo = process.env.MEMO_TEXT;

        if (memo && users && String(users).split(',').length > 0) {

            log('users and memo ok proceeding set flag on');
            //await dbInsertAccount({ account: flag, modified: new Date() });

            users = String(users).split(',');

            for (let i = 0; i < users.length; i++) {
                try {
                    await sendMsg(users[i], memo);
                    log('sent memo to', users[i]);
                } catch (e) {
                    log('error memo user', e);
                }
            }
            log('sent memos done for all');

        } else {
            log('will not send memos conditions not met');
        }
    } else {
        log('flag time expire - skip');
    }
}

////////////////////////////////////////////////////
// EXPORTS /////////////////////////////////////////
////////////////////////////////////////////////////
module.exports = {

    stats: function () {
        return users;
    },

    run: async function () {

        log('msgSubs start');
        await msgSubs();

        if (ENABLE_STEEM == 'on') {
            log('serve steem start');
            serve(SRC_STEEM);
        }

        if (ENABLE_HIVE == 'on') {
            log('serve hive start');
            serve(SRC_HIVE);
        }
    }
};
