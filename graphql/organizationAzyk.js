const mongoose = require('mongoose');
const OrganizationAzyk = require('../models/organizationAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const ItemAzyk = require('../models/itemAzyk');
const BasketAzyk = require('../models/basketAzyk');
const {
    saveImage, saveFile, deleteFile, urlMain, isTestUser, isNotTestUser, isNotEmpty, unawaited, reductionSearchText
} = require('../module/const');
const {deleteOrganizations} = require('../module/organizations');
const {addHistory, historyTypes} = require('../module/history');

const type = `
  type Organization {
    _id: ID
    createdAt: Date
    name: String
    address: [String]
    email: [String]
    phone: [String]
    info: String
    miniInfo: String
    catalog: String
    agentHistory: Int
    status: String
    type: String
    image: String
    warehouse: String
    minimumOrder: Int
    unite: Boolean
    agentSubBrand: Boolean
    clientSubBrand: Boolean
    addedClient: Boolean
    superagent: Boolean
    refusal: Boolean
    onlyDistrict: Boolean
    dateDelivery: Boolean
    onlyIntegrate: Boolean
    autoAcceptAgent: Boolean
    autoAcceptNight: Boolean
    divideBySubBrand: Boolean
    clientDuplicate: Boolean
    calculateStock: Boolean
    cities: [String]
    del: String
    priotiry: Int
    pass: String
    organization: Organization
    
    consignation: Boolean
    autoIntegrate: Boolean
    accessToClient: Boolean
    reiting: Int
 }
`;

const query = `
    brandOrganizations(search: String!, filter: String!, city: String): [Organization]
    organizations(search: String!, filter: String!, city: String): [Organization]
    organization(_id: ID!): Organization
`;

const mutation = `
    addOrganization(cities: [String]!, catalog: Upload, pass: String, warehouse: String!, miniInfo: String!, priotiry: Int, minimumOrder: Int, agentHistory: Int, image: Upload!, name: String!, address: [String]!, email: [String]!, phone: [String]!, info: String!, refusal: Boolean!, addedClient: Boolean!, agentSubBrand: Boolean!, clientSubBrand: Boolean!, unite: Boolean!, superagent: Boolean!, onlyDistrict: Boolean!, dateDelivery: Boolean!, onlyIntegrate: Boolean!, autoAcceptAgent: Boolean!, autoAcceptNight: Boolean!, clientDuplicate: Boolean!, calculateStock: Boolean!, divideBySubBrand: Boolean!): ID
    setOrganization(cities: [String], pass: String, catalog: Upload, warehouse: String, miniInfo: String, _id: ID!, priotiry: Int, minimumOrder: Int, agentHistory: Int, image: Upload, name: String, address: [String], email: [String], phone: [String], info: String, refusal: Boolean, addedClient: Boolean, agentSubBrand: Boolean, clientSubBrand: Boolean, unite: Boolean, superagent: Boolean, onlyDistrict: Boolean, dateDelivery: Boolean, onlyIntegrate: Boolean, autoAcceptAgent: Boolean, autoAcceptNight: Boolean, clientDuplicate: Boolean, calculateStock: Boolean, divideBySubBrand: Boolean): String
    deleteOrganization(_id: ID!): String
    onoffOrganization(_id: ID!): String
`;

const resolvers = {
    brandOrganizations: async (parent, {search, filter, city}, {user}) => {
        // Разрешаем выполнение только для указанных ролей
        if (!['admin', 'экспедитор', 'суперорганизация', 'организация', 'менеджер', 'агент', 'суперагент', 'суперэкспедитор', 'client'].includes(user.role)) {
            return [];
       }

        // Фильтр по городу - либо из аргументов, либо из данных пользователя
        const cityFilter = city || user.city;

        // Флаг для удобства: является ли пользователь клиентом
        const isClient = user.role === 'client';
        const isAdmin = user.role === 'admin';
        const isSuperAgent = ['суперагент', 'суперэкспедитор'].includes(user.role);

        // Получаем все элементы (товары или позиции) из коллекции ItemAzyk с учетом города, статуса и удаления
        const brandItems = await ItemAzyk.find({
            ...(user.organization ? {organization: user.organization} : {}),
            ...(cityFilter ? {city: cityFilter} : {}),
            del: {$ne: 'deleted'}, // исключаем удалённые
            ...(isAdmin ? {} : {status: 'active'}), // если не админ - только активные
       })
            .select('organization subBrand')
            .lean();

        // Множества для хранения уникальных организаций и суббрендов
        let organizations = [];
        let subBrands = [];

        // Для клиента отдельно выбираем организации, у которых clientSubBrand !== true (т.е. без суббрендов)
        // eslint-disable-next-line no-undef
        let organizationsWithoutSubBrandClient = [];

        if (isClient) {
            organizationsWithoutSubBrandClient = await OrganizationAzyk.find({
                ...(cityFilter ? {cities: cityFilter} : {}),
                status: 'active',
                del: {$ne: 'deleted'},
                clientSubBrand: {$ne: true}
           }).distinct('_id');
            organizationsWithoutSubBrandClient = organizationsWithoutSubBrandClient.map(_id => _id.toString())
        }


        // Формируем множества организаций и суббрендов из brandItems
        brandItems.forEach(item => {
            const organizationId = item.organization.toString();
            const subBrandId = item.subBrand&&item.subBrand.toString();
            const isWithoutSubBrandClient = organizationsWithoutSubBrandClient.includes(organizationId)

            // Добавляем организацию, если:
            // - пользователь не клиент, либо
            // - у организации нет суббренда, либо
            // - организация есть в списке организаций без суббрендов для клиента
            // - если это админ
            if (!organizations.includes(organizationId)&&(!isClient || !subBrandId || isWithoutSubBrandClient))
                organizations.push(organizationId);

            // Отдельно собираем суббренды, исключая организации без суббрендов, но не для админа
            if (item.subBrand&&!subBrands.includes(subBrandId)&&!isAdmin&&(!isClient || !isWithoutSubBrandClient)) {
                subBrands.push(subBrandId);
           }
       });

        //filter поиска
        const getFilter = (_ids) => ({
            _id: {$in: _ids},
            name: {$regex: reductionSearchText(search), $options: 'i'},
            status:
                (isAdmin || isTestUser(user))
                    ? filter.length === 0
                        ? {$regex: filter, $options: 'i'}
                        : filter
                    : 'active',
            ...(cityFilter ? {cities: cityFilter} : {}),
            del: {$ne: 'deleted'},
            ...(isSuperAgent ? {superagent: true} : {})
        })

        // Запрашиваем организации с фильтрами и сортируем по приоритету
        organizations = organizations.length?await OrganizationAzyk.find(getFilter(organizations))
            .select('createdAt status name autoAcceptAgent organization _id image miniInfo unite onlyIntegrate onlyDistrict priotiry catalog')
            .sort('name')
            .lean():[];

        // Запрашиваем суббренды с учетом фильтров и с заполнением организации (populate)
        subBrands = subBrands.length?await SubBrandAzyk.find(getFilter(subBrands))
            .populate({
                path: 'organization',
                select: 'createdAt status autoAcceptAgent organization _id unite onlyIntegrate onlyDistrict'
           })
            .sort('name')
            .lean():[];

        // Добавляем в каждый суббренд дополнительные поля из организации и тип для отличия
        subBrands.forEach(subBrand => {
            subBrand.type = 'subBrand';
            subBrand.autoAcceptAgent = subBrand.organization.autoAcceptAgent;
            subBrand.unite = subBrand.organization.unite;
            subBrand.onlyIntegrate = subBrand.organization.onlyIntegrate;
            subBrand.onlyDistrict = subBrand.organization.onlyDistrict;
       });

        // Объединяем суббренды и организации в один массив и сортируем по приоритету
        let organizationsRes = [...subBrands, ...organizations].sort((a, b) => b.priotiry - a.priotiry);

        // Для роли клиента фильтруем организации, учитывая только интеграцию и район клиента
        if (isClient) {
            let districts = await DistrictAzyk.find({client: user.client, organization: {$ne: null}}).distinct('organization').lean()
            districts = districts.map(district => district.toString())
            let integrates = await Integrate1CAzyk.find({client: user.client, organization: {$ne: null}}).distinct('organization').lean()
            integrates = integrates.map(integrate => integrate.toString())
            const filteredOrganizations = []
            for(const organization of organizationsRes) {
                // Если это суббренд, берем данные организации из поля organization
                const organizationId = (organization.organization?organization.organization._id:organization._id).toString();
                // Возвращаем организацию, только если все условия выполнены
                if (
                    !organization.onlyIntegrate||integrates.includes(organizationId)&&
                    !organization.onlyDistrict||districts.includes(organizationId)
                ) filteredOrganizations.push(organization)
            }
            // Фильтруем null значения
            organizationsRes = filteredOrganizations;
       }
        return organizationsRes;
   },
    organizations: async(parent, {search, filter, city}, {user}) => {
        return await OrganizationAzyk.find({
            name: {$regex: reductionSearchText(search), $options: 'i'},
            ...(isNotTestUser(user)&&user.role!=='admin')?{status:'active'}:filter?{status: filter}:{},
            ...city?{cities: city}:{},
            ...user.organization?{_id: user.organization}:{},
            del: {$ne: 'deleted'}
       })
            .select('name _id image miniInfo cities createdAt status')
            .sort('-priotiry')
            .lean()
   },
    organization: async(parent, {_id}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            let subBrand = await SubBrandAzyk.findById(_id).select('organization name minimumOrder').lean()
            let organization = await OrganizationAzyk.findOne({
                _id: subBrand?subBrand.organization:_id
           })
                .lean()
            if(subBrand) {
                organization.name = `${subBrand.name} (${organization.name})`
                if(subBrand.minimumOrder) organization.minimumOrder = subBrand.minimumOrder
           }
            return organization
       }
   }
};

const resolversMutation = {
    addOrganization: async(parent, {cities, catalog, addedClient, agentSubBrand, clientSubBrand, autoAcceptAgent, autoAcceptNight, clientDuplicate, calculateStock, divideBySubBrand, dateDelivery, pass, warehouse, superagent, unite, miniInfo, priotiry, info, phone, email, address, image, name, minimumOrder, agentHistory, refusal, onlyDistrict, onlyIntegrate}, {user}) => {
        if(user.role==='admin') {
            let {stream, filename} = await image;
            image = urlMain + await saveImage(stream, filename)
            if(catalog) {
                let {stream, filename} = await catalog;
                catalog = urlMain + await saveFile(stream, filename)
           }
            const createdObject = await OrganizationAzyk.create({
                image,
                name,
                status: 'active',
                address,
                email,
                phone,
                info,
                minimumOrder,
                refusal,
                priotiry,
                onlyDistrict,
                unite,
                superagent,
                onlyIntegrate,
                miniInfo,
                warehouse,
                cities,
                autoAcceptAgent,
                autoAcceptNight,
                clientDuplicate,
                calculateStock,
                divideBySubBrand,
                dateDelivery,
                addedClient,
                agentSubBrand,
                clientSubBrand,
                agentHistory,
                catalog,
                pass
           })
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'OrganizationAzyk', name, object: createdObject._id}))
            return createdObject._id;
       }
   },
    setOrganization: async(parent, {catalog, cities, addedClient, agentSubBrand, clientSubBrand, dateDelivery, autoAcceptAgent, autoAcceptNight, clientDuplicate, calculateStock, divideBySubBrand, pass, warehouse, miniInfo, superagent, unite, _id, priotiry, info, phone, email, address, image, name, minimumOrder, agentHistory, refusal, onlyDistrict, onlyIntegrate}, {user}) => {
        if(user.role==='admin'||(['суперорганизация', 'организация'].includes(user.role)&&user.organization.toString()===_id.toString())) {
            let object = await OrganizationAzyk.findById(_id)
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'OrganizationAzyk', name: object.name, object: _id, data: {catalog, cities, addedClient, agentSubBrand, clientSubBrand, dateDelivery, autoAcceptAgent, autoAcceptNight, clientDuplicate, calculateStock, divideBySubBrand, pass, warehouse, miniInfo, superagent, unite, priotiry, info, phone, email, address, image, name, minimumOrder, agentHistory, refusal, onlyDistrict, onlyIntegrate}}))
            if (image) {
                let {stream, filename} = await image;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveImage(stream, filename),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
           }
            if(catalog) {
                let {stream, filename} = await catalog;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveFile(stream, filename),
                    deleteFile(object.catalog)
                ])
                object.catalog = urlMain+savedFilename
           }
            if(user.role==='admin'&&isNotEmpty(pass)) object.pass = pass
            if(cities) {
                object.cities = cities
                await SubBrandAzyk.updateMany({organization: _id}, {cities})
                await ItemAzyk.updateMany({organization: _id}, {city: cities[0]})
            }
            if(name) object.name = name
            if(info) object.info = info
            if(phone) object.phone = phone
            if(email) object.email = email
            if(address) object.address = address
            if(warehouse) object.warehouse = warehouse
            if(isNotEmpty(superagent)) object.superagent = superagent
            if(isNotEmpty(unite)) object.unite = unite
            if(isNotEmpty(onlyDistrict)) object.onlyDistrict = onlyDistrict
            if(isNotEmpty(autoAcceptAgent)) object.autoAcceptAgent = autoAcceptAgent
            if(isNotEmpty(clientDuplicate)) object.clientDuplicate = clientDuplicate
            if(isNotEmpty(calculateStock)) object.calculateStock = calculateStock
            if(isNotEmpty(autoAcceptNight)) object.autoAcceptNight = autoAcceptNight
            if(isNotEmpty(divideBySubBrand)) object.divideBySubBrand = divideBySubBrand
            if(isNotEmpty(dateDelivery)) object.dateDelivery = dateDelivery
            if(isNotEmpty(onlyIntegrate)) object.onlyIntegrate = onlyIntegrate
            if(isNotEmpty(priotiry)) object.priotiry = priotiry
            if(isNotEmpty(refusal)) object.refusal = refusal
            if(isNotEmpty(minimumOrder)) object.minimumOrder = minimumOrder
            if(isNotEmpty(miniInfo)) object.miniInfo = miniInfo
            if(isNotEmpty(addedClient)) object.addedClient = addedClient
            if(isNotEmpty(agentSubBrand)) object.agentSubBrand = agentSubBrand
            if(isNotEmpty(clientSubBrand)) object.clientSubBrand = clientSubBrand
            if(isNotEmpty(agentHistory)) object.agentHistory = agentHistory
            await object.save();
       }
        return 'OK'
   },
    deleteOrganization: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            let organization = await OrganizationAzyk.findById(_id).select('name').lean()
            await deleteOrganizations([_id])
            unawaited(() => addHistory({user, type: historyTypes.delete, model: 'OrganizationAzyk', name: organization.name, object: _id}))
       }
        return 'OK'
   },
    onoffOrganization: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            const organization = await OrganizationAzyk.findById(_id).select('name status').lean()
            const newStatus = organization.status==='active'?'deactive':'active'
            let items = await ItemAzyk.find({organization: organization._id}).distinct('_id')
            // eslint-disable-next-line no-undef
            await Promise.all([
                OrganizationAzyk.updateOne({_id}, {status: newStatus}),
                EmploymentAzyk.updateMany({organization: _id}, {status: newStatus}),
                BasketAzyk.deleteMany({item: {$in: items}}),
                ItemAzyk.updateMany({_id: {$in: items}}, {status: newStatus})
            ])
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'OrganizationAzyk', name: organization.name, object: _id, data: {status: newStatus}}))
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;