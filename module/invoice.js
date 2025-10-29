const InvoiceAzyk = require('../models/invoiceAzyk');

// Функция запуска слушателя изменения поля "taken"
module.exports.startInvoiceWatcher = () => {
    const changeStream = InvoiceAzyk.watch(
        [/*
            {
                $match: {
                    operationType: 'update',
                    'updateDescription.updatedFields.taken': { $exists: true },
                },
            },
        */],
        { fullDocument: 'updateLookup' }
    );

    changeStream.on('change', async (change) => {
        console.log('change')
        const {formatErrorDetails, unawaited} = require('./const');
        const ModelsErrorAzyk = require('../models/errorAzyk');
        const {consignationCashFlow} = require('./consigFlow');
        try {
            const { fullDocument } = change;
            if(fullDocument.paymentMethod==='Консигнация') {
                await consignationCashFlow(fullDocument);
            }
        } catch (err) {
            unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'InvoiceWatcher'}))
        }
    });

    changeStream.on('error', (err) => {
        const {formatErrorDetails, unawaited} = require('./const');
        const ModelsErrorAzyk = require('../models/errorAzyk');
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'InvoiceWatcher'}))
    });

    process.on('SIGINT', async () => {
        await changeStream.close();
        process.exit(0);
    });

    console.log('Слушатель изменения поля "taken" запущен');
}

// Пример вызова:
// startTakenWatcher();
