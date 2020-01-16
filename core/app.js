const dsteem = require('dsteem');

const MSG = process.env.MSG;
const PROVIDER = process.env.API_PROVIDER;
const RSP_ACC = process.env.RSP_ACCOUNT;
const RSP_KEY = dsteem.PrivateKey.fromString(process.env.TOKEN);
const MAX_SEND = Number(process.env.MAX_SEND || 500);

let serving = false;

function log(x) {
    console.log(x);
}

function replaceAll(str, find, replace) {
    return str.split(find).join(replace);
}

let users = [];

function id(user) {
	for(let i = 0; i <users.length; i++) {
		if(users[i] === user)
			return i;
	}
	return -1;
}

async function sendMsg(user, msg) {
	try {
		const client = new dsteem.Client(PROVIDER, {});
		await client.broadcast.transfer({
			from: RSP_ACC,
			to: user,
			amount: '0.001 STEEM',
			memo: msg
		}, RSP_KEY);
	} catch (e) {
		log(e);
	}
}

async function checkAndMsg(user, msg) {
	if(id(user) < 0) {
		try {
			await sendMsg(user, msg);
			users.push(user);
			log('sent message for [' + users.length + '] ' + user);
		} catch(e) {
			log(e);
		}
	}
}

async function serve() {
    
    if(serving === true) {
        log('already serving...');
        return;
    }
    
    serving = true;
    
	const client = new dsteem.Client(PROVIDER, {});
	const stream = client.blockchain.getBlockStream();
	
	stream.on('data', async (block) => {
		
		if(users.length > MAX_SEND) {
			console.log('limit reached!');
			return;
		}
		
		for (let i = 0; i < block.transactions.length; i++) {
			
			if(users.length > MAX_SEND) {
				console.log('limit reached!');
				break;
			}
			
			let type = block.transactions[i].operations[0][0];
			let data = block.transactions[i].operations[0][1];
			let user = null;
			
			if( type === 'comment' || type === 'post') {
					
				// author
				user = data['author'];
				await checkAndMsg(user, MSG);
				
				// parent author
				user = data['parent_author'];
				await checkAndMsg(user, MSG);
			}
/*
			if( type === 'transfer' ) {

				// from
				user = data['from'];
				await checkAndMsg(user, MSG);
				
				// parent author
				user = data['to'];
				await checkAndMsg(user, MSG);				
			}
*/
		}
	});
}

////////////////////////////////////////////////////
// EXPORTS /////////////////////////////////////////
////////////////////////////////////////////////////

module.exports = {
    
    stats: function() {
        return users;
    },

    run: async function () {
        await serve();
    }
};
