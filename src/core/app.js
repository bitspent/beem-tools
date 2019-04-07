const dsteem = require('dsteem');

const PROVIDER = process.env.API_PROVIDER;
const REQ_ACC = process.env.REQ_ACCOUNT;
const RSP_ACC = process.env.RSP_ACCOUNT;
const REQ_PRICE = process.env.PRICE;
const RSP_KEY = dsteem.PrivateKey.fromString(process.env.TOKEN);

const TIMER_WATCH = 2 * 60 * 1000;

function replaceAll(str, find, replace) {
    return str.split(find).join(replace);
}

function log(x) {
    console.info(x);
}

function dbg(x) {
    log('        ' + replaceAll(x + '', '\n', '\n        '));
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

async function dbPendingTransactions() {
    return new Promise((res, rej) => {
        db.query("select * from transactions where status = 'pending' order by created asc", asyncResult(res, rej));
    });
}

async function dbProcessedTransactions() {
    return new Promise((res, rej) => {
        db.query("select * from transactions where status = 'processed' or status = 'send-error' order by created asc", asyncResult(res, rej));
    });
}

async function dbGet(trxId) {
    return new Promise((res, rej) => {
        db.query(`select * from transactions where status = 'pending' and trx_id = '${trxId}'`, asyncResult(res, rej));
    });
}

async function dbInsertTransaction(transaction) {
    return new Promise((res, rej) => {
        db.query('insert into transactions set ?', transaction, asyncResult(res, rej));
    });
}

async function dbUpdateTransaction(transaction) {
    return new Promise((res, rej) => {
        db.query('replace into transactions set ?', transaction, asyncResult(res, rej));
    });
}

async function syncFromBlockchain() {
    log('syncFromBlockchain()');
    const client = new dsteem.Client(PROVIDER, {});
    const transactions = await client.database.call('get_account_history', [REQ_ACC, -1, 5000]);
    for (let i = 0; i < transactions.length; i++) {
        let transaction = transactions[i][1];
        if (transaction['op'][0] === 'transfer'
            && transaction['op'][1]['to'] === REQ_ACC
            && transaction['op'][1]['memo'] === 'magic'
            && transaction['op'][1]['amount'] === REQ_PRICE) {
            try {
                await dbInsertTransaction({
                    trx_id: transaction['trx_id'],
                    account: transaction['op'][1]['from'],
                    status: 'pending',
                    created: transaction['timestamp']
                });
            } catch (e) {

            }
        }
    }
    dbg(`fetched ${transactions.length} transactions to db`);
}

async function processPendingRequest() {

    log('processPendingRequest()');

    let transactions = await dbPendingTransactions();

    if (transactions.length === 0) {

        dbg('no pending requests to process');

    } else {
        dbg(`got ${transactions.length} request`);
        for (let i = 0; i < transactions.length; i++) {
            let tx = await dbGet(transactions[i].trx_id);
            if (tx.length === 1) {
                dbg(`processing request ${i + 1}`);
                await checkInOutTransfers(transactions[i]);
            }
        }
        dbg('pending request processed');
    }
}

async function checkInOutTransfers(trx) {

    log(`checkInOutTransfers(${trx.account})`);

    let from = trx.account;

    trx.status = 'processing';

    await dbUpdateTransaction(trx);

    const to = 'magicdice';
    const client = new dsteem.Client(PROVIDER, {});

    let sentSTM = 0;
    let sentSBD = 0;
    let rcvdSTM = 0;
    let rcvdSBD = 0;

    let lastIndex = -1;

    while (lastIndex === -1 || lastIndex >= 5000) {

        let transactions = await client.database.call('get_account_history', [from, lastIndex, 5000]);
        lastIndex = transactions[0][0];
        dbg('we are on lastIndex ' + lastIndex);
        dbg('checking transactions: ' + transactions.length);

        for (let i = 0; i < transactions.length; i++) {
            let transaction = transactions[i][1];
            if (transaction['op'][0] === 'transfer') {
                let amount = transaction['op'][1]['amount'];
                if (transaction['op'][1]['to'] === to) {
                    if (amount.indexOf('STEEM') > 0) {
                        sentSTM += Number(amount.split(' ')[0]);
                    } else {
                        sentSBD += Number(amount.split(' ')[0]);
                    }
                } else if (transaction['op'][1]['from'] === to) {
                    if (amount.indexOf('STEEM') > 0) {
                        rcvdSTM += Number(amount.split(' ')[0]);
                    } else {
                        rcvdSBD += Number(amount.split(' ')[0]);
                    }
                }
            }
        }
    }

    sentSTM = Math.round(sentSTM);
    sentSBD = Math.round(sentSBD);
    rcvdSTM = Math.round(rcvdSTM);
    rcvdSBD = Math.round(rcvdSBD);

    let msg = `MagicDice Stats: STEEM ( sent ${sentSTM}, received: ${rcvdSTM}, difference: ${rcvdSTM - sentSTM} )` +
        `  SBD ( sent ${sentSBD}, received: ${rcvdSBD}, difference: ${rcvdSBD - sentSBD} )`;

    trx.status = 'processed';
    trx.result = msg;

    await dbUpdateTransaction(trx);
}

async function sendResults() {

    log(`sendResults()`);

    const client = new dsteem.Client(PROVIDER, {});

    let transactions = await dbProcessedTransactions();

    if (transactions.length === 0) {
        dbg('no results to send');
    } else {

        dbg(`sending ${transactions.length} result`);

        for (let i = 0; i < transactions.length; i++) {

            dbg(`sending result to ${transactions[i].account}`);

            transactions[i].status = 'sending';
            await dbUpdateTransaction(transactions[i]);

            try {
                await client.broadcast.transfer({
                    from: RSP_ACC,
                    to: transactions[i].account,
                    amount: '0.001 STEEM',
                    memo: transactions[i].result
                }, RSP_KEY);
                transactions[i].status = 'sent';
                await dbUpdateTransaction(transactions[i]);
            } catch (e) {
                transactions[i].status = 'send-error';
                await dbUpdateTransaction(transactions[i]);
            }
        }

        dbg('results sent');
    }
}

let cycleRunning = false;

async function cycle() {
    if (cycleRunning === false) {
        cycleRunning = true;
        await syncFromBlockchain();
        await processPendingRequest();
        await sendResults();
        cycleRunning = false;
    }
}

////////////////////////////////////////////////////
// EXPORTS /////////////////////////////////////////
////////////////////////////////////////////////////

module.exports = {
    run: async function () {
        await cycle();
    }
};