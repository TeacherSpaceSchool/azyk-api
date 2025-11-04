const {createAdmin} = require('../module/user');
const {Worker, isMainThread} = require('worker_threads');
const {reductionBannersAzyk} = require('./banners');
const {reductionIntegrate1C} = require('./integrate1C');
const {reductionDistrict} = require('./district');
const {mockConsigFlow} = require('./consigFlow');

let startDeleteBD = async () => {
    if(isMainThread) {
        let w = new Worker('./thread/deleteBD.js', {workerData: 0});
        w.on('message', (msg) => {
            console.log('DeleteBD: '+msg);
       })
        w.on('error', console.error);
        w.on('exit', (code) => {
            if(code !== 0)
                console.error(new Error(`DeleteBD stopped with exit code ${code}`))
       });
        console.log('DeleteBD '+w.threadId+ ' run')
   }
}

let startResetUnloading = async () => {
    if(isMainThread) {
        let w = new Worker('./thread/resetUnloading.js', {workerData: 0});
        w.on('message', (msg) => {
            console.log('ResetUnloading: '+msg);
       })
        w.on('error', console.error);
        w.on('exit', (code) => {
            if(code !== 0)
                console.error(new Error(`ResetUnloading stopped with exit code ${code}`))
       });
        console.log('ResetUnloading '+w.threadId+ ' run')
   }
}

let startOutXMLShoroAzyk = async () => {
    if(isMainThread) {
        let w = new Worker('./thread/singleOutXMLAzyk.js', {workerData: 0});
        w.on('message', (msg) => {
            console.log('SingleOutXMLAzyk: '+msg);
       })
        w.on('error', console.error);
        w.on('exit', (code) => {
            if(code !== 0)
                console.error(new Error(`SingleOutXMLAzyk stopped with exit code ${code}`))
       });
        console.log('SingleOutXMLAzyk '+w.threadId+ ' run')
   }
}

let startReminderClient = async () => {
    if(isMainThread) {
        let w = new Worker('./thread/reminderClient.js', {workerData: 0});
        w.on('message', (msg) => {
            console.log('ReminderClient: '+msg);
       })
        w.on('error', console.error);
        w.on('exit', (code) => {
            if(code !== 0)
                console.error(new Error(`ReminderClient stopped with exit code ${code}`))
       });
        console.log('ReminderClient '+w.threadId+ ' run')
   }
}

let start = async () => {
    await createAdmin();
    //threads
    await startResetUnloading()
    await startReminderClient();
    await startOutXMLShoroAzyk();
    await startDeleteBD();
    //reductions
    await reductionBannersAzyk()
    await reductionIntegrate1C()
    await reductionDistrict()

    await mockConsigFlow()

    //watcher
    /*setTimeout(async () => {
        console.time('reduction DB')
        await reductionOldestDB();
        await deleteDeprecatedOrganizations();
        await compactOldestDB()
        console.timeEnd('reduction DB')
   }, 10000)*/
}

module.exports.start = start;