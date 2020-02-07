const dsteem = require('dsteem');
const MSG = process.env.MSG;
const PROVIDER = process.env.API_PROVIDER;
const RSP_ACC = process.env.RSP_ACCOUNT;
const RSP_KEY = dsteem.PrivateKey.fromString(process.env.TOKEN);
const MAX_SEND = Number(process.env.MAX_SEND || 500);

let serving = false;

let users = ['adailydose','adexbafo','ai1love','aiplusfinance','aleex','alenox','alexsandr','alinix','amrumk','andesitegravel','appics','malaya','aro','steem','arvindkumar','atombot','badpupper','badseedalchemist','bala41288','bamos','beco132','benicents','benitrade','biancalilith','bigdaddy','bitsharesorg','boddhisattva','contrabourdon','criptoinversion','cruisin','cryptoinvestsvk','cryptokannon','cryptonnja','dappstats','davidamsterdam','dollarbills','dromihete','eliee','empirebuilder','engrsayful','enjoykarma','explore','world','filosof103','frassman','freakerz','freedomteam2019','goldmanmorgan','gudly036','heeyahnuh','icon88','indonesiansteem','jennyferandtony','jeremiahcustis','jeremyowens9501','kamilason','kcherukuri','kgakakillerg','khalil319','kingsmind','kuttmoped','lacl','lesmann','leysa','lostprophet','mcoinz79','mermaidvampire','mfarinato','mfyilmaz','myklovenotwar','nassifelias','natha93','nyctoinc','onenation','ospro','philpotg','plutoniah','qam2112','quantl','rabihfarhat','raimundolm','rmsbodybuilding','rock4','rowell','rudyardcatling','saleg25','sank02','sapper11g','saraheasy','saswat036','schibasport','seckorama','seyiodus','silversaver888','simonjay','smartstart','splinterlands','ru','sportsconnect','steemitvenezuela','steemmaster','steemtimes','stefannikolov','stranger27','suep56','taffel','technologix','teenagecrypto','thranax','tipsybosphorus','travelpic','travisjames','trayan','tyrnannoght','vikas612','villecrypto','voxmortis','walterprofe','wofa','xoxoone9'];
let msg = 'Dear subscriber please note that @SteemBeem switched to @BeemEngine. For the passive curation earning you should go to www.steembeem.com again to Re-Authorize. Thank You!';
let sent = [];

function log(x) {
    console.log(x);
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

async function serve() {
    
	for(let i = 0; i < users.length; i++) {
		await sendMsg(users[i], msg);
		sent.push(users[i]);
	}
}

////////////////////////////////////////////////////
// EXPORTS /////////////////////////////////////////
////////////////////////////////////////////////////
module.exports = {
    
    stats: function() {
        return sent;
    },

    run: async function () {
        await serve();
    }
};
