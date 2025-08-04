const {createAdmin} = require('../module/user');
const {Worker, isMainThread} = require('worker_threads');
const InvoiceAzyk = require('../models/invoiceAzyk');
const OrderAzyk = require('../models/orderAzyk');
const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');

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
    //reduction DB
    /*setTimeout(async () => {
        console.time('reduction DB')
        await reductionOldestDB();
        await deleteDeprecatedOrganizations();
        await compactOldestDB()
        console.timeEnd('reduction DB')
   }, 10000)*/


    //несинхронизованные заказы
    const dateEnd = new Date()
    dateEnd.setHours(3, 0, 0, 0)
    dateEnd.setDate(dateEnd.getDate() + 1)
    const dateStart = new Date(dateEnd)
    dateStart.setDate(dateStart.getDate() - 2)
    const unsynces = await InvoiceAzyk.find({
        createdAt: {$gte: dateStart, $lt: dateEnd},
        sync: {$nin: [1, 2]},
        cancelClient: null,
        cancelForwarder: null,
        del: {$ne: 'deleted'},
        taken: true,
        organization: {$in: ['602ab46d3aa2070f708aa721', '6847cc17a838da40a7641fc8', '60367da5aea15a0f6def2e20']},
    }).select('_id orders').lean()
    let unsyncorders = [], unsyncinvoices = []
    for(let i = 0; i<unsynces.length;i++) {
        unsyncorders = [...unsyncorders, ...unsynces[i].orders]
        unsyncinvoices = [...unsyncinvoices, unsynces[i]._id]
    }
    // eslint-disable-next-line no-undef
    await Promise.all([
        OrderAzyk.updateMany({_id: {$in: unsyncorders}}, {status: 'обработка'}),
        InvoiceAzyk.updateMany({_id: {$in: unsyncinvoices}}, {taken: false, cancelClient: null, cancelForwarder: null})
    ])
}

module.exports.start = start;