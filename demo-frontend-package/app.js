const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const icons = {
  projectMetric:"<svg class=\"icon project-metric-icon\" viewBox=\"0 0 1126 1024\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M659.0464 110.2336A59.0848 59.0848 0 0 1 718.08 51.2h236.0832a59.0848 59.0848 0 0 1 59.0336 59.0336v78.6432a59.0848 59.0848 0 0 1-59.0336 59.0848h-236.0832a59.0848 59.0848 0 0 1-59.0336-59.0848z\" fill=\"currentColor\" /><path d=\"M153.6 768.8192a59.0848 59.0848 0 0 1 59.0848-59.0336h236.0832a59.0848 59.0848 0 0 1 59.0336 59.0336v78.6432a59.0848 59.0848 0 0 1-59.0336 59.0848H212.6848A59.0848 59.0848 0 0 1 153.6 847.4624z\" fill=\"currentColor\" /><path d=\"M482.6112 51.2h-250.88a78.336 78.336 0 0 0-78.336 78.336v413.4912a78.336 78.336 0 0 0 78.336 78.336h250.88a78.336 78.336 0 0 0 78.336-78.336V129.3824a78.336 78.336 0 0 0-78.336-78.336z\" fill=\"currentColor\" /><path d=\"M684.2368 906.5984h250.88a78.336 78.336 0 0 0 78.336-78.336V414.7712a78.336 78.336 0 0 0-78.336-78.336h-250.88a78.336 78.336 0 0 0-78.336 78.336v413.4912a78.336 78.336 0 0 0 78.336 78.336z\" fill=\"currentColor\" /></svg>",
  tractor:"<svg class=\"icon vehicle-source-icon tractor-source-icon\" viewBox=\"0 0 1024 1024\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M989.18464 254.912H893.44064V80.576C893.44064 35.84 857.21664 0 813.69664 0h-604.16c-44.16 0-79.744 36.608-79.744 80.576v174.336H34.81664a35.008 35.008 0 0 0-34.816 35.2v193.28c0 19.072 15.232 35.2 34.816 35.2h94.976v206.528h-10.88c-20.992 0-38.4 17.6-38.4 38.848v79.104c0 21.248 17.408 38.848 38.4 38.848h13.824v115.008c0 14.592 12.288 27.072 26.816 27.072h79.744a26.88 26.88 0 0 0 26.88-27.072v-80.64H768.00064v80.64c0 14.592 12.352 27.072 26.88 27.072h79.744a26.88 26.88 0 0 0 26.816-27.072V881.92h2.88c21.056 0 38.4-17.6 38.4-38.848v-79.104a38.912 38.912 0 0 0-38.4-38.848h-10.88V518.592h95.744a35.456 35.456 0 0 0 34.816-35.2v-193.28a34.56 34.56 0 0 0-34.816-35.2zM129.79264 474.624H92.80064V298.88h36.992v175.744z m71.04-174.336c0-15.36 12.352-27.776 27.584-27.776h567.168c15.232 0 27.52 12.416 27.52 27.776V466.56c0 15.36-12.288 27.84-27.52 27.84H228.41664a27.712 27.712 0 0 1-27.52-27.84V300.288z m198.016 311.36V567.68h225.536v43.968H398.84864z m225.536 49.024v43.968H398.84864v-43.968h225.536z m-380.736 159.68a8.064 8.064 0 0 1-7.936 8.064H150.84864a8.064 8.064 0 0 1-8-8.064v-38.784c0-4.416 3.648-8.064 8-8.064h84.864c4.352 0 7.936 3.648 7.936 8.064v38.784z m-42.048-117.888a8.064 8.064 0 0 1-8-8.064V622.592c0-4.352 3.648-8.064 8-8.064h119.68c4.352 0 7.936 3.712 7.936 8.064v71.808a8.064 8.064 0 0 1-7.936 8.064H201.60064z m523.584 119.36H298.88064v-43.904h426.368v43.904z m-22.4-119.36a8.064 8.064 0 0 1-8-8.064V622.592c0-4.352 3.584-8.064 7.936-8.064h119.68c4.352 0 8 3.712 8 8.064v71.808a8.064 8.064 0 0 1-8 8.064h-119.68z m177.6 117.888a8.064 8.064 0 0 1-7.936 8.064h-84.864a8.064 8.064 0 0 1-8-8.064v-38.784c0-4.416 3.648-8.064 8-8.064h84.864c4.352 0 7.936 3.648 7.936 8.064v38.784z m51.52-345.728h-37.76V298.112h37.76v176.512z\" fill=\"currentColor\" /></svg>",
  trailer:"<svg class=\"icon vehicle-source-icon\" viewBox=\"0 0 1024 1024\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M82.5856 678.0416h819.0976c13.824 0 25.7024-10.8544 25.7024-25.7024V260.096a25.4976 25.4976 0 0 0-25.7024-25.7024H82.5856a25.4976 25.4976 0 0 0-25.7024 25.7024v392.2432c0 13.824 10.9056 25.7024 25.7024 25.7024z m712.3968-351.744c0-11.8784 8.9088-20.736 20.736-20.736 11.8784 0 20.7872 8.8576 20.7872 20.736v260.864a20.2752 20.2752 0 0 1-20.7872 20.736 20.2752 20.2752 0 0 1-20.736-20.736V326.2976z m-129.4336 0c0-11.8784 8.9088-20.736 20.736-20.736 11.8784 0 20.7872 8.8576 20.7872 20.736v260.864a20.2752 20.2752 0 0 1-20.7872 20.736 20.2752 20.2752 0 0 1-20.736-20.736V326.2976z m-129.4336 0c0-11.8784 8.9088-20.736 20.736-20.736 11.8784 0 20.736 8.8576 20.736 20.736v260.864a20.2752 20.2752 0 0 1-20.736 20.736 20.8896 20.8896 0 0 1-20.736-20.736V326.2976z m-129.4336 0c0-11.8784 8.9088-20.736 20.736-20.736 11.8784 0 20.736 8.8576 20.736 20.736v260.864a20.2752 20.2752 0 0 1-20.736 20.736 20.2752 20.2752 0 0 1-20.736-20.736V326.2976z m-129.4336 0c0-11.8784 8.9088-20.736 20.736-20.736 11.8784 0 20.736 8.8576 20.736 20.736v260.864a20.2752 20.2752 0 0 1-20.736 20.736 20.2752 20.2752 0 0 1-20.736-20.736V326.2976z m-130.4576 0c0-11.8784 8.9088-20.736 20.7872-20.736 11.8272 0 20.736 8.8576 20.736 20.736v260.864a20.2752 20.2752 0 0 1-20.736 20.736 20.2752 20.2752 0 0 1-20.7872-20.736V326.2976zM981.7088 738.304h-2.9184a13.5168 13.5168 0 0 0-13.824 13.824v13.824h-38.5536v-28.672a16.64 16.64 0 0 0-16.7936-16.7424H73.6768a16.64 16.64 0 0 0-16.7936 16.7936v82.944c0 13.8752 10.9056 24.7296 24.7296 24.7296h56.32c3.9424 55.3472 51.3536 100.8128 109.6704 100.8128a109.312 109.312 0 0 0 109.6704-101.7856h268.8c4.9152 56.32 52.3264 101.7856 109.6192 101.7856a109.312 109.312 0 0 0 109.6704-101.7856h56.32c13.824 0 24.7296-10.8544 24.7296-24.6784v-23.7568h38.5024v13.824c0 7.936 5.9392 13.824 13.824 13.824h2.9696c7.936 0 13.824-5.888 13.824-13.824v-56.32c0-8.8576-5.888-14.7968-13.824-14.7968zM247.6032 890.4704c-30.6176 0-55.296-24.6784-55.296-55.296 0-30.6688 24.6784-55.3472 55.296-55.3472 30.6176 0 55.296 24.6784 55.296 55.296 0 29.696-24.6784 55.3472-55.296 55.3472z m488.0896 0c-30.6176 0-55.296-24.6784-55.296-55.296 0-30.6688 24.6784-55.3472 55.296-55.3472 30.6176 0 55.296 24.6784 55.296 55.296 0 29.696-24.6784 55.3472-55.296 55.3472z\" fill=\"currentColor\" /></svg>",
  project:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16v13H4zM8 7V4h8v3M8 12h8M8 16h5"/></svg>',
  customer:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 8h5M18.5 5.5v5"/></svg>',
  users:'<svg class="icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  shield:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4"/></svg>',
  region:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>',
  plus:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search:'<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  back:'<svg class="icon" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  file:'<svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6v20h12V6zM14 2v4h4M9 13h6M9 17h6"/></svg>',
  truck:'<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>',
  menu:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close:'<svg class="icon" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  warn:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3ZM12 9v5M12 18h.01"/></svg>',
  calc:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h5M8 15h3M14 14l2 2 3-3"/></svg>'
};

const vehicleSourceIcon='<svg class="icon vehicle-source-icon tractor-source-icon" viewBox="0 0 1610 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M1243.428571 877.714286m-146.285714 0a4 4 0 1 0 292.571429 0 4 4 0 1 0-292.571429 0Z" fill="currentColor"/><path d="M365.714286 877.714286m-146.285714 0a4 4 0 1 0 292.571429 0 4 4 0 1 0-292.571429 0Z" fill="currentColor"/><path d="M1572.534857 0 768.036571 0C747.812571 0 731.428571 16.384 731.428571 36.608L731.428571 658.285714l-73.142857 0L658.285714 109.787429C658.285714 89.197714 641.974857 73.142857 621.897143 73.142857L328.96 73.142857c-19.748571 0-47.579429 11.702857-61.330286 26.148571L6.948571 450.011429C1.718857 469.174857 0 501.942857 0 522.203429l0 318.756571C0 861.220571 16.274286 877.714286 36.315429 877.714286L146.285714 877.714286c0-121.197714 98.230857-219.428571 219.428571-219.428571s219.428571 98.230857 219.428571 219.428571l438.857143 0c0-121.197714 98.230857-219.428571 219.428571-219.428571s219.428571 98.230857 219.428571 219.428571l109.385143 0C1592.722286 877.714286 1609.142857 861.476571 1609.142857 841.472l0-73.618286L1609.142857 36.608C1609.142857 16.347429 1592.758857 0 1572.534857 0zM552.813714 402.212571c0 20.224-16.457143 36.644571-36.534857 36.644571L169.435429 438.857143c-20.187429 0-27.245714-13.531429-16.054857-29.878857l131.620571-192.182857C296.338286 200.265143 321.718857 186.88 341.979429 186.88l174.336 0c20.150857 0 36.498286 16.530286 36.498286 36.644571L552.813714 402.212571z" fill="currentColor"/></svg>';

const stages = ['10%项目导入','25%市场尽调','50%初审通过','75%联合评审通过','90%签约落地','100%交车/投运'];
const statuses = ['进行中','待发车','租赁中','运营中','暂停','善后处理','已终止','储备'];
const ecoProgress = ['储备-待调研','储备-调研中','储备-条件不成熟','签约-注册公司','签约-运营筹备','试运营','正式运营','流失','转租售业务'];
const users = [
  {name:'林晨',account:'demo.sales.east',department:'新能源销售一部',position:'区域销售经理',role:'销售人员',region:'华东大区',scope:'本人负责或参与项目',status:'启用',last:'2026-09-18 09:00'},
  {name:'周琪',account:'demo.sales.east2',department:'新能源销售一部',position:'客户经理',role:'销售人员',region:'华东大区',scope:'本人负责或参与项目',status:'启用',last:'2026-09-18 08:40'},
  {name:'陈航',account:'demo.sales.south',department:'港运行业组',position:'行业销售经理',role:'销售人员',region:'华南大区',scope:'本人负责或参与项目',status:'启用',last:'2026-09-17 17:30'},
  {name:'王磊',account:'demo.sales.north',department:'大宗运输组',position:'大客户经理',role:'销售人员',region:'华北大区',scope:'本人负责或参与项目',status:'启用',last:'2026-09-17 16:20'},
  {name:'李敏',account:'demo.sales.west',department:'新能源销售二部',position:'客户经理',role:'销售人员',region:'西南大区',scope:'本人负责或参与项目',status:'启用',last:'2026-09-17 15:10'},
  {name:'赵敏',account:'demo.director.east',department:'华东大区销售中心',position:'大区总监',role:'大区总监',region:'华东大区',scope:'所属大区',status:'启用',last:'2026-09-18 09:10'},
  {name:'刘帆',account:'demo.director.south',department:'华南大区销售中心',position:'大区总监',role:'大区总监',region:'华南大区',scope:'所属大区',status:'启用',last:'2026-09-17 18:10'},
  {name:'谢宏',account:'demo.executive',department:'经营管理部',position:'经营管理负责人',role:'最高管理层',region:'—',scope:'全部演示数据',status:'启用',last:'2026-09-18 08:00'},
  {name:'高远',account:'demo.admin',department:'信息技术部',position:'系统管理员',role:'系统管理员',region:'—',scope:'默认无业务数据',status:'启用',last:'2026-09-18 09:20'}
];
const customers = [
  {id:'CUST-001',name:'东澜绿色物流有限公司',short:'东澜绿色物流',industry:'物流运输',owner:'林晨',region:'华东大区',address:'上海市浦东新区临港港区',capital:'5,000万元人民币',scope:'道路货物运输、供应链管理、仓储服务',controller:'东澜控股有限公司',risk:'未发现重大经营风险',riskDate:'2026-09-08',brief:'新能源车队项目合作客户。',contact:'沈涛',phone:'021-5558-1201',title:'运营总监'},
  {id:'CUST-002',name:'海岳港运供应链有限公司',short:'海岳港运',industry:'港口物流',owner:'李敏',region:'华南大区',capital:'8,000万元人民币',scope:'港区集疏运、物流信息服务、货运代理',controller:'海岳实业有限公司',risk:'经营正常',riskDate:'2026-09-05',contact:'韩磊',phone:'0755-5558-1202',title:'项目经理'},
  {id:'CUST-003',name:'北辰资源运输有限公司',short:'北辰资源运输',industry:'大宗运输',owner:'王磊',region:'华北大区',capital:'3,000万元人民币',scope:'矿产运输、普通货运、车辆租赁',controller:'北辰能源集团',risk:'存在季节性运力波动',riskDate:'2026-08-29',contact:'宋伟',phone:'010-5558-1203',title:'采购负责人'},
  {id:'CUST-004',name:'新源城市配送有限公司',short:'新源城配',industry:'城市配送',owner:'周琪',region:'华东大区',capital:'1,500万元人民币',scope:'城市配送、冷链物流、仓储服务',controller:'新源供应链有限公司',risk:'无重大风险提示',riskDate:'2026-09-10',contact:'徐宁',phone:'0571-5558-1204',title:'车队负责人'},
  {id:'CUST-005',name:'云驰新能源运输有限公司',short:'云驰新能源',industry:'新能源物流',owner:'陈航',region:'西南大区',capital:'2,000万元人民币',scope:'新能源道路运输、车辆运营管理',controller:'云驰交通科技有限公司',risk:'运营数据仍在积累',riskDate:'2026-09-01',contact:'许岚',phone:'028-5558-1205',title:'副总经理'},
  {id:'CUST-006',name:'启航城际配送有限公司',short:'启航城配',industry:'城市配送',owner:'林晨',region:'华东大区',capital:'1,200万元人民币',scope:'城市配送、仓配一体化服务',controller:'启航物流有限公司',risk:'暂无重大风险',riskDate:'2026-09-13',brief:'城际配送客户档案。',contact:'吴昊',phone:'025-5558-1206',title:'运营经理',created:'2026-09-13',updated:'2026-09-13 10:20'},
  {id:'CUST-007',name:'宁港航运供应链有限公司',short:'宁港航运',industry:'港口物流',owner:'林晨',region:'华东大区',capital:'6,000万元人民币',scope:'港口集疏运、集装箱运输与仓储',controller:'宁港航运集团',risk:'资信资料待补充',riskDate:'2026-09-14',brief:'港航运输前期尽调客户。',contact:'顾珊',phone:'0574-5558-1207',title:'项目总监',created:'2026-09-12',updated:'2026-09-14 16:05'},
  {id:'CUST-008',name:'华途干线运输有限公司',short:'华途干线运输',industry:'新能源物流',owner:'周琪',region:'华东大区',capital:'3,500万元人民币',scope:'新能源道路运输、车队运营管理',controller:'华途物流集团',risk:'经营正常',riskDate:'2026-09-15',brief:'干线运输签约客户。',contact:'董成',phone:'021-5558-1208',title:'采购总监',created:'2026-09-10',updated:'2026-09-15 11:30'},
  {id:'CUST-009',name:'申港集装箱运输有限公司',short:'申港集运',industry:'港口物流',owner:'周琪',region:'华东大区',capital:'9,000万元人民币',scope:'集装箱道路运输、港区短驳',controller:'申港物流控股有限公司',risk:'经营稳定',riskDate:'2026-09-15',brief:'集装箱短倒投运客户。',contact:'方圆',phone:'021-5558-1209',title:'车队负责人',created:'2026-09-08',updated:'2026-09-15 14:40'}
];
customers.forEach(customer=>{
  if(!customer.created)customer.created='2026-09-11';
  customer.created=normalizeSecondPrecision(customer.created);
  customer.updated=normalizeSecondPrecision(customer.updated||customer.created);
  customer.brief??=`${customer.short}的虚构 DEMO 客户档案，用于展示客户、项目与车辆关联。`;
});
const projects = [
  {id:'PRJ-DEMO-001',name:'临港港区短倒电动化项目',customer:'东澜绿色物流',region:'华东大区',owner:'林晨',members:['周琪'],stage:stages[0],status:'储备',eco:ecoProgress[0],tractor:20,trailer:20,updated:'2026-09-12 09:18',type:'港口短倒',source:'客户转介绍',place:'上海市浦东新区临港港区'},
  {id:'PRJ-DEMO-002',name:'嘉兴冷链干线车辆替换项目',customer:'新源城配',region:'华东大区',owner:'周琪',members:['林晨'],stage:stages[0],status:'进行中',eco:ecoProgress[1],tractor:12,trailer:0,updated:'2026-09-11 17:42',type:'干线物流',source:'主动开发',place:'浙江省嘉兴市秀洲区'},
  {id:'PRJ-DEMO-003',name:'深圳盐田港新能源牵引项目',customer:'海岳港运',region:'华南大区',owner:'陈航',members:[],stage:stages[1],status:'暂停',eco:ecoProgress[2],tractor:30,trailer:35,updated:'2026-09-10 14:20',type:'港口短倒',source:'渠道合作',place:'广东省深圳市盐田港'},
  {id:'PRJ-DEMO-004',name:'鄂尔多斯矿区封闭运输项目',customer:'北辰资源运输',region:'华北大区',owner:'王磊',members:[],stage:stages[1],status:'已终止',eco:'流失',tractor:18,trailer:0,updated:'2026-09-09 11:05',type:'矿区运输',source:'主动开发',place:'内蒙古鄂尔多斯市'},
  {id:'PRJ-DEMO-005',name:'沪甬跨区干线一期项目',customer:'东澜绿色物流',region:'华东大区',owner:'林晨',members:['赵敏'],stage:stages[2],status:'待发车',eco:ecoProgress[3],tractor:25,trailer:25,updated:'2026-09-12 08:36',type:'干线物流',source:'集团协同',place:'上海市至浙江省宁波市'},
  {id:'PRJ-DEMO-006',name:'深圳盐田港示范车队项目',customer:'海岳港运',region:'华南大区',owner:'陈航',members:['刘帆'],stage:stages[3],status:'租赁中',eco:ecoProgress[4],tractor:40,trailer:0,updated:'2026-09-11 10:14',type:'港口短倒',source:'渠道合作',place:'广东省深圳市盐田港'},
  {id:'PRJ-DEMO-007',name:'成渝绿色物流示范项目',customer:'云驰新能源',region:'西南大区',owner:'李敏',members:[],stage:stages[4],status:'善后处理',eco:'试运营',tractor:16,trailer:0,updated:'2026-09-08 15:22',type:'干线物流',source:'客户转介绍',place:'四川省成都市双流区'},
  {id:'PRJ-DEMO-008',name:'杭州城市配送二期项目',customer:'新源城配',region:'华东大区',owner:'周琪',members:['林晨'],stage:stages[5],status:'运营中',eco:'正式运营',tractor:10,trailer:10,deliveredTractor:10,deliveredTrailer:10,updated:'2026-09-12 09:01',type:'城市配送',source:'集团协同',place:'浙江省杭州市上城区'},
  {id:'PRJ-DEMO-009',name:'嘉兴冷链车辆更新调研项目',customer:'新源城配',region:'华东大区',owner:'周琪',members:['林晨'],stage:stages[1],status:'暂停',eco:ecoProgress[1],tractor:8,trailer:0,updated:'2026-09-12 10:20',type:'干线物流',source:'主动开发',place:'浙江省嘉兴市秀洲区'},
  {id:'PRJ-DEMO-010',name:'临港港区车队合作项目',customer:'东澜绿色物流',region:'华东大区',owner:'林晨',members:['赵敏'],stage:stages[3],status:'租赁中',eco:ecoProgress[4],tractor:15,trailer:15,updated:'2026-09-12 11:05',type:'港口短倒',source:'客户转介绍',place:'上海市浦东新区临港港区'},
  {id:'PRJ-DEMO-011',name:'沪杭干线运输签约项目',customer:'新源城配',region:'华东大区',owner:'周琪',members:['林晨'],stage:stages[4],status:'善后处理',eco:'试运营',tractor:18,trailer:18,deliveredTractor:0,deliveredTrailer:0,updated:'2026-09-12 11:36',type:'干线物流',source:'集团协同',place:'上海市至浙江省杭州市'},
  {id:'PRJ-DEMO-012',name:'宁波港航车队更新调研项目',customer:'宁港航运',region:'华东大区',owner:'林晨',members:['周琪'],stage:stages[1],status:'进行中',eco:ecoProgress[1],updated:'2026-09-14 16:05',type:'港口短倒',source:'主动开发',place:'浙江省宁波市北仑区'},
  {id:'PRJ-DEMO-013',name:'长三角新能源车队签约项目',customer:'华途干线运输',region:'华东大区',owner:'周琪',members:['林晨'],stage:stages[4],status:'已终止',eco:'流失',updated:'2026-09-15 11:30',type:'干线物流',source:'客户转介绍',place:'江苏省苏州市吴中区'},
  {id:'PRJ-DEMO-014',name:'洋山港集装箱短倒投运项目',customer:'申港集运',region:'华东大区',owner:'周琪',members:['林晨'],stage:stages[5],status:'运营中',eco:'正式运营',updated:'2026-09-15 14:40',type:'港口短倒',source:'集团协同',place:'上海市浦东新区洋山港'}
];
const vehicleRows = {
  'PRJ-DEMO-005':[
    {kind:'牵引车',brand:'创维',model:'NJL4250KEKBEV',battery:'600kWh',axle:'—',qty:25,note:'一期需求'},
    {kind:'挂车',brand:'海岳车辆',model:'13米平板半挂车',battery:'—',axle:'3',qty:25,note:'牵引车配套'}
  ]
};

const vehicleRentalStatuses = [
  {value:'可租',count:24,tone:'available'},
  {value:'在租中',count:37,tone:'rented'},
  {value:'维修中',count:11,tone:'repair'},
  {value:'整备中',count:15,tone:'preparing'},
  {value:'待整改',count:9,tone:'rectify'},
  {value:'预排',count:12,tone:'reserved'},
  {value:'借出',count:20,tone:'loaned'}
];

const vehicleSourceAnalytics = {
  tractor:{total:128,locations:[['上海市浦东新区',36],['浙江省嘉兴市',29],['江苏省苏州市',24],['安徽省芜湖市',21],['山东省青岛市',18]],models:[['创维 NJL4250KEKBEV',57],['创维 NJL4250KELEV',42],['创维 NJL4250KJEV',29]]},
  trailer:{total:96,inRent:58,unlinked:38,inspectionWarning:7,types:[['13米平板半挂车',44],['仓栅式半挂车',32],['集装箱骨架半挂车',20]],brands:[['海岳 HY9400平板半挂车',24],['东澜 DL9400仓栅半挂车',20],['华途 HT9400仓栅半挂车',18],['申港 SG9400骨架半挂车',17],['北辰 BC9400平板半挂车',17]]}
};

const vehiclePlanConfigs = {
  tractor: {
    title:'牵引车库存表', description:'全部为虚构 DEMO 数据', route:'/vehicles/tractors', sourceCount:128, displayNameIndex:1, searchIndexes:[0,1,24,25,26,27], primaryIndexes:[0,1],
    headers:['VIN','车牌号','当前所在地','车辆型号','配置信息','发动机号','电池','可租状态','驱动形式','电机型号','电机功率','变速箱','载荷','营运证时间','实际生产年限','合格证年限','实际年龄','合格证年龄','是否改码','行驶证注册日期','经销商','上牌方','颜色','是否在租','在租项目编号','在租项目名称','预排项目编号','预排项目名称','旧客户','现租客户','提档信息','备胎','交强险到期日期','商业险到期日期','融资公司','融资金额','融资起止期限','分期信息A','分期信息B','抵押状况'],
    rows:[
      ['LNEC7D5B6RS001201','沪A·N1201','上海市浦东新区','创维 NJL4250KEKBEV','600kWh换电版','DL-ENG-001','宁德时代600kWh','在租中','中央驱动','永磁同步电机','405','AMT四档','37720','2027-05-01','2025-03-15','2025-03-28',1.44,1.4,'否','2025-05-30','东澜汽车销售有限公司','东澜汽车租赁有限公司','白色','是','PRJ-DEMO-008','杭州城市配送二期项目','','','','新源城配','','有','2027-05-13','2027-06-22','','','','','',''],
      ['LNEC7D5B6RS001202','沪A·N1202','上海市浦东新区','创维 NJL4250KEKBEV','600kWh换电版','DL-ENG-002','宁德时代600kWh','可租','中央驱动','永磁同步电机','405','AMT四档','37720','2027-05-01','2025-03-15','2025-03-28',1.44,1.4,'否','2025-05-29','东澜汽车销售有限公司','东澜汽车租赁有限公司','白色','否','','','','','','','','有','2027-05-13','2027-06-03','','','','','',''],
      ['LNEC7D5B6RS001203','浙F·N3021','浙江省嘉兴市','创维 NJL4250KELEV','500kWh标准版','HT-ENG-003','亿纬锂能500kWh','预排','中央驱动','永磁同步电机','450','AMT四档','38570','2027-05-01','2025-12-24','2025-12-24',0.66,0.66,'否','2026-02-11','华途商用车有限公司','华途融资租赁有限公司','蓝色','否','','','PRJ-DEMO-013','长三角新能源车队签约项目','','','','有','2027-02-10','','华途金融租赁有限公司','100000','36期等额分期','','','抵押登记完成'],
      ['LNEC7D5B6RS001204','苏E·N5836','江苏省苏州市','创维 NJL4250KJEV','450kWh换电版','HY-ENG-004','国轩高科450kWh','维修中','中央驱动','永磁同步电机','420','AMT四档','38000','2027-06-01','2025-06-01','2025-06-01',1.25,1.25,'否','2025-06-15','海岳商用车有限公司','海岳资产管理有限公司','白色','否','','','','','','','','有','2027-06-15','2027-07-01','','','','','',''],
      ['LNEC7D5B6RS001205','皖B·N6712','安徽省芜湖市','创维 NJL4250KEKBEV','600kWh换电版','DL-ENG-005','宁德时代600kWh','在租中','中央驱动','永磁同步电机','405','AMT四档','37720','2027-07-01','2025-07-01','2025-07-01',1.2,1.2,'否','2025-07-11','东澜汽车销售有限公司','东澜汽车租赁有限公司','白色','是','PRJ-DEMO-010','临港港区车队合作项目','','','','东澜绿色物流','','有','2027-07-14','2027-08-04','','','','','',''],
      ['LNEC7D5B6RS001206','鲁B·N8095','山东省青岛市','创维 NJL4250KELEV','500kWh标准版','HT-ENG-006','亿纬锂能500kWh','整备中','中央驱动','永磁同步电机','450','AMT四档','38570','2027-08-01','2025-08-01','2025-08-01',1.1,1.1,'否','2025-08-10','华途商用车有限公司','华途融资租赁有限公司','蓝色','否','','','','','','','','有','2027-08-15','2027-09-01','','','','','',''],
      ['LNEC7D5B6RS001207','浙F·N4168','浙江省嘉兴市','创维 NJL4250KJEV','450kWh换电版','HY-ENG-007','国轩高科450kWh','待整改','中央驱动','永磁同步电机','420','AMT四档','38000','2027-09-01','2025-09-01','2025-09-01',1.0,1.0,'否','2025-09-12','海岳商用车有限公司','海岳资产管理有限公司','白色','否','','','','','','','','有','2027-09-15','2027-10-01','','','','','',''],
      ['LNEC7D5B6RS001208','苏E·N7290','江苏省苏州市','创维 NJL4250KEKBEV','600kWh换电版','DL-ENG-008','宁德时代600kWh','借出','中央驱动','永磁同步电机','405','AMT四档','37720','2027-10-01','2025-10-01','2025-10-01',0.9,0.9,'否','2025-10-12','东澜汽车销售有限公司','东澜汽车租赁有限公司','白色','否','','','','','','华瑞物流有限公司','','有','2027-10-15','2027-11-01','','','','','','']
    ]
  },
  trailer: {
    title:'挂车库存表', description:'全部为虚构 DEMO 数据', route:'/vehicles/trailers', sourceCount:96, displayNameIndex:2, searchIndexes:[0,2,8,9], primaryIndexes:[0,2],
    headers:['VIN','资产所属','车牌号','车辆类型','品牌型号','行驶证注册日期','检验有效期','可租状态','在租项目编号','项目名称','总质量（kg）','整备质量（kg）','核定载质量（kg）','外廓尺寸（mm）'],
    rows:[
      ['LJRH13A45RS020101','海岳供应链资产管理有限公司','沪B·G8601','13米平板半挂车','海岳 HY9400平板半挂车','2026-05-22','2027-05-01','在租','PRJ-DEMO-008','杭州城市配送二期项目',37500,5800,31700,'13000*2550*2700'],
      ['LJRH13A45RS020102','海岳供应链资产管理有限公司','沪B·G8602','13米平板半挂车','海岳 HY9400平板半挂车','2026-05-22','2027-05-01','可租','','',37500,5800,31700,'13000*2550*2700'],
      ['LJRH13A45RS020103','东澜汽车租赁有限公司','浙B·G3521','仓栅式半挂车','东澜 DL9400仓栅半挂车','2026-05-27','2027-05-01','在租','PRJ-DEMO-010','临港港区车队合作项目',37500,5800,31700,'13000*2550*2700'],
      ['LJRH13A45RS020104','东澜汽车租赁有限公司','苏E·G6157','仓栅式半挂车','华途 HT9400仓栅半挂车','2026-05-22','2027-05-01','可租','','',37500,5800,31700,'13000*2550*2700'],
      ['LJRH13A45RS020105','申港物流资产有限公司','沪C·G9410','集装箱骨架半挂车','申港 SG9400骨架半挂车','2026-05-22','2027-05-01','在租','PRJ-DEMO-014','洋山港集装箱短倒投运项目',37500,5800,31700,'13000*2550*2700'],
      ['LJRH13A45RS020106','北辰运输资产有限公司','鲁B·G7088','13米平板半挂车','北辰 BC9400平板半挂车','2026-05-22','2026-09-30','可租','','',37500,5800,31700,'13000*2550*2700']
    ]
  }
};
const initialVehicleImportTime='2026-09-16 18:00:00';
function vehicleInventoryTimestamp(date=new Date()){
  const pad=value=>String(value).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
const vehicleHiddenColumns={tractor:[23,24,25,26,27],trailer:[8,9]};
const vehicleLegacyProjectIdColumns={tractor:[24,26],trailer:[8]};
function vehicleInventoryColumnIndexes(kind){
  const hidden=new Set(vehicleHiddenColumns[kind]||[]);
  return vehiclePlanConfigs[kind].headers.map((_,index)=>index).filter(index=>!hidden.has(index));
}
Object.entries(vehiclePlanConfigs).forEach(([kind,config])=>{
  config.rows=config.rows.map((cells,index)=>({
    id:`${config.route}-${index}`,
    cells,
    linkedProjectId:(vehicleLegacyProjectIdColumns[kind]||[]).map(column=>String(cells[column]||'').trim()).find(Boolean)||'',
    updatedAt:initialVehicleImportTime
  }));
});

// 现有原型样例统一使用搭建日期；不是历史业务项目的真实创建时间。
projects.forEach(p=>{
  if(!p.created)p.created='2026-09-11';
  p.created=normalizeSecondPrecision(p.created);
  p.updated=normalizeSecondPrecision(p.updated||p.created);
  p.background??=`${p.customer}的虚构 DEMO ${p.type||'运输'}项目，用于展示${p.stage}阶段下的客户、需求车辆与关联车辆数据。`;
});
const state = { user:null, keyword:'', stage:'', status:'', region:'', customerFilter:'', ownerFilter:'', viewState:'normal', detailTab:'vehicles', vehicleStatusFilter:vehicleRentalStatuses.map(item=>item.value), vehicleAnalysisCollapsed:false };
const currentRoute = () => (location.hash.slice(1) || '/login').split('?')[0];
const currentHashParams = () => new URLSearchParams((location.hash.slice(1).split('?')[1] || ''));
const isAdmin = () => state.user?.role === '系统管理员';
const isExecutive = () => state.user?.role === '最高管理层';
const isDirector = () => state.user?.role === '大区总监';
const canEdit = () => !isExecutive() && !isAdmin();
function visibleProjects() {
  let rows = permittedProjects();
  if (state.keyword) rows = rows.filter(p => [p.name,p.id,p.customer].some(v => v.toLowerCase().includes(state.keyword.toLowerCase())));
  if (state.stage) rows = rows.filter(p => p.stage === state.stage);
  if (state.status) rows = rows.filter(p => p.status === state.status);
  if (state.region) rows = rows.filter(p => p.region === state.region);
  if (state.customerFilter) rows = rows.filter(p => p.customer === state.customerFilter);
  if (state.ownerFilter) rows = rows.filter(p => p.owner === state.ownerFilter);
  return rows;
}
function visibleCustomers() {
  if (!state.user || isAdmin()) return [];
  if (isExecutive()) return customers;
  if (isDirector()) return customers.filter(c => c.region === state.user.region);
  const names = new Set(permittedProjects().map(p=>p.customer));
  return customers.filter(c => c.owner === state.user.name || names.has(c.short));
}
function toast(message, type='success') {
  const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; $('#toast-region').append(el); setTimeout(()=>el.remove(),2800);
}
function go(path){ location.hash=path; }
function statusClass(s){ return ['已终止','暂停'].includes(s)?'danger':['善后处理','储备'].includes(s)?'warning':['运营中','正式运营'].includes(s)?'success':'info'; }
function navItem(path,label,icon){ return `<button class="nav-item ${currentRoute().startsWith(path)?'active':''}" data-go="${path}" aria-label="${label}">${icon}<span>${label}</span></button>`; }
function calcNavActive(){ const route=currentRoute(); return route==='/calculation' || /\/calculation(\/|$)/.test(route); }

function shell(content){
  const admin=isAdmin();
  return `<div class="app-shell"><header class="topbar"><div class="brand"><div class="brand-mark">${icons.truck}</div><span>新能源重卡经营平台</span></div><div class="topbar-main"><div class="scope-note">数据范围：${esc(state.user.scope)}</div><div class="user-menu"><div class="avatar">${esc(state.user.name.slice(-1))}</div><div class="identity"><div class="identity-line"><strong>${esc(state.user.name)}</strong><span class="identity-separator" aria-hidden="true">｜</span><span class="identity-role">${esc(state.user.role)} · ${esc(state.user.region)}</span></div></div><button class="btn small logout-btn" id="logout">退出</button></div></div></header>
  <aside class="sidebar" aria-label="主导航">${admin?`<div class="nav-group-title">系统配置</div>${navItem('/users','用户管理',icons.users)}${navItem('/roles','角色与权限',icons.shield)}${navItem('/regions','大区管理',icons.region)}`:`<div class="nav-group-title">业务管理</div>${navItem('/projects','项目管理',icons.project)}${navItem('/customers','客户管理',icons.customer)}<button class="nav-item ${calcNavActive()?'active':''}" data-go="/calculation" aria-label="项目测算中心">${icons.calc}<span>项目测算中心</span></button><div class="nav-group-title">车辆管理</div>${navItem('/vehicles/tractors','牵引车管理',icons.tractor)}${navItem('/vehicles/trailers','挂车管理',icons.trailer)}`}</aside><main class="main" id="main-content">${content}</main></div>`;
}
function pageHead(title,desc='',actions=''){return `<div class="page-head"><div><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div><div class="head-actions">${actions}</div></div>`}

function loginPage(error=''){
  return `<div class="login-page"><section class="login-aside"><div class="login-brand"><div class="brand-mark">${icons.truck}</div>新能源重卡业务经营管理平台</div><div class="login-message"><h1>让项目推进有据可循</h1><p>统一管理客户、项目、需求用车与业务资料，让不同角色只看到应看的信息。</p><div class="login-stats"><div class="login-stat"><strong>14</strong><span>演示项目</span></div><div class="login-stat"><strong>6</strong><span>销售阶段</span></div><div class="login-stat"><strong>4</strong><span>角色视角</span></div></div></div><small>原型演示环境 · 所有数据均为虚构</small></section><main class="login-main"><form class="login-box" id="login-form"><h2>登录</h2><p>请选择或输入虚构 DEMO 账号</p>${error?`<div class="tag danger" style="margin-bottom:16px">${icons.warn}${error}</div>`:''}<div class="field"><label class="required" for="account">登录账号</label><input class="input" id="account" name="account" autocomplete="username" placeholder="例如 demo.sales.east"></div><div class="field"><label class="required" for="password">密码</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="输入任意非空演示密码"></div><button class="btn primary" style="width:100%;min-height:40px" type="submit">登录</button><div class="demo-accounts"><h3>快速选择演示身份</h3><div class="account-grid">${[
    ['demo.sales.east','林晨','销售人员'],['demo.director.east','赵敏','大区总监'],['demo.executive','谢宏','最高管理层'],['demo.admin','高远','系统管理员']
  ].map(a=>`<button type="button" class="account-btn" data-account="${a[0]}"><strong>${a[1]}</strong><small>${a[2]}</small></button>`).join('')}</div></div></form></main></div>`;
}

function statsBlock(rows){ return enhancedStats(rows);
  const counts=stages.map(s=>rows.filter(p=>p.stage===s).length);
  const reached=stages.map((_,i)=>rows.filter(p=>stages.indexOf(p.stage)>=i).length);
  const rates=stages.slice(1).map((_,i)=>reached[i]?`${(reached[i+1]/reached[i]*100).toFixed(reached[i+1]/reached[i]*100%1?1:0)}%`:'—');
  return `<section class="stats-strip" aria-label="项目统计"><div class="stats-primary"><div class="stat"><div class="stat-label">当前范围项目</div><div class="stat-value">${rows.length}<small>个</small></div></div>${stages.map((s,i)=>`<button class="stat ${state.stage===s?'selected':''}" data-stage="${s}"><div class="stat-label">${s}</div><div class="stat-value">${counts[i]}<small>个</small></div></button>`).join('')}</div><div class="conversion-row"><span class="conversion-title">相邻阶段累计转化率</span>${rates.map((r,i)=>`<span class="conversion-item">${stages[i+1].split('%')[0]}%<strong>${r}</strong></span>`).join('')}</div></section>`;
}
function stateControl(){ return `<aside class="demo-state-tool" id="demo-state-tool" aria-label="演示工具"><button type="button" class="demo-drag-handle" id="demo-drag-handle" aria-label="移动演示工具，使用方向键调整位置" title="拖动移动；方向键调整位置">⠿ 演示状态</button><select class="select" id="view-state" aria-label="演示页面状态"><option value="normal">正常状态</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="noresult">No Result</option><option value="error">Error</option><option value="partial">Partial Data</option></select></aside>`; }
function projectRows(rows){
  if(state.viewState==='loading') return Array.from({length:5},()=>`<tr>${Array.from({length:14},()=>'<td><div class="skeleton"></div></td>').join('')}</tr>`).join('');
  if(state.viewState==='error') return `<tr class="empty-row"><td colspan="14"><div>${icons.warn}<p>项目数据加载失败</p><button class="btn" data-retry>重试</button></div></td></tr>`;
  if(state.viewState==='empty') return `<tr class="empty-row"><td colspan="14">当前还没有项目${canEdit()?`<br><button class="btn primary" style="margin-top:12px" data-go="/projects/new">新建第一个项目</button>`:''}</td></tr>`;
  if(state.viewState==='noresult'||!rows.length) return `<tr class="empty-row"><td colspan="14">没有符合当前条件的项目<br><button class="btn" style="margin-top:12px" data-reset>清除筛选</button></td></tr>`;
  return rows.map(p=>`<tr><td class="object-cell"><div class="object-name" data-go="/projects/${p.id}">${esc(p.name)}</div><div class="object-meta">${p.id}</div></td><td>${p.customer}</td><td>${p.region}</td><td>${p.owner}</td><td>${stageMarkup(p.stage)}</td><td><span class="tag ${statusClass(p.status)}">${p.status}</span></td><td>${p.eco}</td><td class="num">${p.tractor}</td><td class="num">${projectDeliveredText(p,'deliveredTractor')}</td><td class="num">${p.trailer}</td><td class="num">${projectDeliveredText(p,'deliveredTrailer')}</td><td data-label="创建时间">${esc(p.created||'未提供')}</td><td data-label="更新时间">${esc(p.updated||'未提供')}</td><td data-label="操作"><div class="table-actions"><button class="btn ghost small text-action" data-go="/projects/${p.id}">查看</button>${canEdit()?`<button class="btn ghost small text-action" data-go="/projects/${p.id}/edit">编辑</button>`:''}</div></td></tr>`).join('');
}
function projectList(){
  const permissionRows=visibleProjects(); const rows=state.viewState==='partial'?permissionRows.slice(0,5):permissionRows;
  const customerOptions=[...new Set(permissionRows.map(p=>p.customer).filter(Boolean))];
  const ownerOptions=[...new Set(permissionRows.map(p=>p.owner).filter(Boolean))];
  return shell(`${pageHead('项目管理',`${state.user.name}的可见范围 · 统计与筛选同步`,`${stateControl()}${canEdit()?`<button class="btn primary" data-go="/projects/new">${icons.plus}<span class="btn-label-mobile">新建项目</span></button>`:''}`)}${statsBlock(permissionRows)}${state.viewState==='partial'?`<div class="tag warning" style="margin-bottom:12px">${icons.warn}部分项目的生态进度数据暂不可用，列表其他数据不受影响</div>`:''}<div class="status-summary"><span class="label">项目状态</span>${statuses.map(s=>`<button class="status-chip ${state.status===s?'selected':''}" data-status="${s}"><span class="dot ${statusClass(s)}"></span>${s}<strong>${permissionRows.filter(p=>p.status===s).length}</strong></button>`).join('')}</div><section class="panel project-list-panel"><div class="toolbar"><div class="field search"><label class="sr-only" for="project-search">搜索项目</label><input id="project-search" class="input" value="${esc(state.keyword)}" placeholder="搜索项目名称、编号或客户"></div><select class="select" id="project-customer-filter" style="width:auto"><option value="">全部所属客户</option>${customerOptions.map(customer=>`<option value="${esc(customer)}" ${state.customerFilter===customer?'selected':''}>${esc(customer)}</option>`).join('')}</select><select class="select" id="project-owner-filter" style="width:auto"><option value="">全部负责人</option>${ownerOptions.map(owner=>`<option value="${esc(owner)}" ${state.ownerFilter===owner?'selected':''}>${esc(owner)}</option>`).join('')}</select><select class="select" id="region-filter" style="width:auto"><option value="">全部大区</option>${['华东大区','华南大区','华北大区','西南大区'].map(r=>`<option ${state.region===r?'selected':''}>${r}</option>`).join('')}</select><select class="select" id="stage-filter" style="width:auto"><option value="">全部阶段</option>${stages.map(s=>`<option ${state.stage===s?'selected':''}>${s}</option>`).join('')}</select><button class="btn primary" id="search-btn">${icons.search}查询</button><button class="btn" data-reset>重置</button></div>${state.keyword||state.stage||state.status||state.region||state.customerFilter||state.ownerFilter?`<div class="active-filters"><span>已生效：</span>${state.keyword?`<span class="filter-tag">关键词 ${esc(state.keyword)}</span>`:''}${state.customerFilter?`<span class="filter-tag">客户 ${esc(state.customerFilter)}</span>`:''}${state.ownerFilter?`<span class="filter-tag">负责人 ${esc(state.ownerFilter)}</span>`:''}${state.stage?`<span class="filter-tag">阶段 ${state.stage}</span>`:''}${state.status?`<span class="filter-tag">状态 ${state.status}</span>`:''}${state.region?`<span class="filter-tag">大区 ${state.region}</span>`:''}<button class="btn ghost small" data-reset>全部清除</button></div>`:''}<div class="table-wrap responsive"><table><thead><tr><th>项目</th><th>所属客户</th><th>大区</th><th>负责人</th><th>项目阶段</th><th>项目状态</th><th>生态进度</th><th class="num">需求车辆</th><th class="num">已交付车辆</th><th class="num">需求挂车</th><th class="num">已交付挂车</th><th>创建时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${projectRows(rows)}</tbody></table></div><div class="pagination"><span>共 ${rows.length} 条，每页 20 条</span><div class="pages"><button class="page-btn active">1</button><button class="page-btn">2</button></div></div></section>`);
}

function projectForm(id){
  const p=projects.find(x=>x.id===id); if(id&&!p)return errorPage('404'); if(p&&!permittedProjects().includes(p))return errorPage('403'); const editing=!!p; const vals=p||{name:'',customer:'',region:state.user.region==='—'?'':state.user.region,owner:state.user.name,members:[],stage:stages[0],status:'进行中',eco:'',type:'',source:'',place:''};
  return shell(`<div class="form-page ${editing?'project-edit-page':''}">${pageHead(`<button class="btn ghost small" data-go="${editing?`/projects/${id}`:'/projects'}">${icons.back}<span>返回</span></button> ${editing?'编辑项目':'新建项目'}`,'项目阶段、状态和生态进度相互独立')}<form id="project-form"><section class="form-section"><div class="section-title"><div><h2>项目基本信息</h2><p>项目编号由系统生成，当前使用演示规则</p></div></div><div class="form-grid"><div class="field span-2"><label class="required" for="project-name">项目名称</label><input id="project-name" class="input" value="${esc(vals.name)}" placeholder="请输入项目名称"><div class="field-error" id="name-error"></div></div><div class="field"><label class="required">所属客户</label><select class="select" id="project-customer"><option value="">请选择</option>${customers.map(c=>`<option ${vals.customer===c.short?'selected':''} value="${c.short}">${c.short}</option>`).join('')}</select></div><div class="field"><label class="required">项目负责人</label><select class="select" id="project-owner">${users.filter(u=>['销售人员','大区总监'].includes(u.role)).map(u=>`<option ${vals.owner===u.name?'selected':''}>${u.name}</option>`).join('')}</select><div class="help">改选他人后，创建人不会因创建行为持续获得访问权。</div></div><div class="field"><label class="required">所属大区</label><select class="select" id="project-region">${['华东大区','华南大区','华北大区','西南大区'].map(r=>`<option ${vals.region===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>项目成员</label><input class="input" value="${esc(vals.members.join('、'))}" placeholder="请选择项目成员"></div><div class="field"><label>项目类型 <span class="tag">演示字典</span></label><select class="select"><option>${vals.type||'请选择'}</option><option>港口短倒</option><option>矿区运输</option><option>干线物流</option><option>城市配送</option></select></div><div class="field"><label>项目来源 <span class="tag">演示字典</span></label><select class="select"><option>${vals.source||'请选择'}</option><option>客户转介绍</option><option>主动开发</option><option>渠道合作</option><option>集团协同</option></select></div><div class="field"><label>项目地点</label><input class="input" value="${esc(vals.place)}" placeholder="省市或详细地点"></div><div class="field span-3"><label>项目简介</label><textarea class="textarea" placeholder="记录项目场景、需求和关键背景">${editing?'客户计划用新能源重卡替换现有运力，当前信息由销售根据线下业务事实维护。':''}</textarea></div></div></section><section class="form-section"><div class="section-title"><div><h2>项目推进信息</h2><p>三个维度回答不同的业务问题，分别维护</p></div></div><div class="dimension-grid"><div class="dimension-card"><h3>项目阶段</h3><p>销售业务里程碑，用于累计漏斗转化</p><select class="select" id="stage-select">${stages.map(s=>`<option ${vals.stage===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="dimension-card"><h3>项目状态</h3><p>当前经营状态，不会自动改变项目阶段</p><select class="select">${statuses.map(s=>`<option ${vals.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="dimension-card"><h3>生态项目进度</h3><p>生态业务当前节点，不参与销售漏斗</p><select class="select"><option value="">非生态项目 / 暂不填写</option>${ecoProgress.map(s=>`<option ${vals.eco===s?'selected':''}>${s}</option>`).join('')}</select></div></div></section><section class="form-section"><div class="section-title"><div><h2>计划用车需求</h2><p>可以暂不录入，项目将显示“车辆需求待完善”</p></div></div><div class="vehicle-editor"><div class="vehicle-toolbar"><div class="vehicle-summary"><span>计划车辆 <strong id="tractor-total">${vals.tractor||0}</strong> 辆</span><span>计划挂车 <strong id="trailer-total">${vals.trailer||0}</strong> 辆</span></div><button type="button" class="btn" id="add-vehicle">${icons.plus}新增需求</button></div><div class="table-wrap"><table><thead><tr><th>类型</th><th>品牌</th><th>车型</th><th>电池容量 / 轴数</th><th class="num">数量</th><th>备注</th><th>操作</th></tr></thead><tbody id="vehicle-body">${editing?(vehicleRows[id]||[]).map((v,i)=>`<tr data-kind="${v.kind}"><td>${v.kind}</td><td>${v.brand}</td><td>${v.model}</td><td>${v.kind==='牵引车'?v.battery:`${v.axle}轴`}</td><td class="num" data-qty="${v.qty}">${v.qty}</td><td>${v.note}</td><td><button type="button" class="btn ghost small" data-delete-vehicle="${i}">删除</button></td></tr>`).join(''):`<tr class="empty-row"><td colspan="7" style="height:100px">暂无计划用车需求</td></tr>`}</tbody></table></div></div></section><section class="form-section"><div class="section-title"><div><h2>项目资料</h2><p>资料继承项目数据权限，演示环境不上传真实文件</p></div></div><div class="file-row project-upload-row"><div class="file-icon">${icons.file}</div><div class="file-main"><div class="file-name">将文件拖入此处，或点击“上传资料”</div><div class="file-meta">允许格式与文件大小属于实现前待确认项</div></div><button type="button" class="btn" id="upload-file">${icons.plus}上传资料</button></div></section><div class="sticky-actions"><button type="button" class="btn" data-go="${editing?`/projects/${id}`:'/projects'}">取消</button><button class="btn primary" id="save-project" type="submit">保存项目</button></div></form></div>`);
}

function projectDetail(id){
  const p=projects.find(x=>x.id===id); if(!p) return errorPage('404'); if(!permittedProjects().includes(p)) return errorPage('403');
  const idx=stages.indexOf(p.stage); const rows=vehicleRows[id]||[{kind:'牵引车',brand:'远航',model:'演示车型',battery:'500kWh',axle:'—',qty:p.tractor,note:'计划需求'}].filter(v=>v.qty);
  const tabs={vehicles:'需求与交付',files:'项目资料',visits:'跟进记录',history:'修改记录'};
  let body='';
  if(!Object.hasOwn(tabs,state.detailTab)) state.detailTab='vehicles';
  if(state.detailTab==='vehicles') body=planDeliveryTable(p);
  if(state.detailTab==='visits') body=projectVisitsMarkup(p);
  if(state.detailTab==='files') body=projectDocumentsMarkup(p);
  if(state.detailTab==='history') body=projectHistory(id);
  const calcHint=(()=>{ try{ if(!window.PmCalc) return ''; const n=window.PmCalc.listScenarios(id).length; return n?`<span class="tag calc-status-hint info">${n} 个测算方案</span>`:'<span class="tag calc-status-hint">暂无测算方案</span>'; }catch{ return ''; } })();
  return shell(`<div class="object-header project-object-header"><div class="object-header-top"><div><button class="btn ghost small" data-go="/projects">${icons.back}返回项目列表</button><h1 style="margin-top:12px">${esc(p.name)}</h1><div class="object-id project-identity"><span aria-label="项目编号"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>${p.id}</span><span aria-label="所属客户"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 9h2m4 0h2M8 12h2m4 0h2"/></svg>${projectCustomerLink(p)}</span><span class="project-identity-address" aria-label="项目地址"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>${esc(p.place||'未提供')}</span>${p.place?`<button type="button" class="address-copy" data-copy-project-address="${esc(p.id)}" aria-label="复制项目地址" title="复制项目地址"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg></button>`:''}</span></div></div><div class="head-actions">${calcHint}<button class="btn" data-go="/projects/${id}/calculation">${icons.calc}<span>项目测算</span></button>${isExecutive()?'<span class="tag">只读视图</span>':canEdit()?`<button class="btn primary" data-go="/projects/${id}/edit">编辑项目</button>`:''}</div></div><div class="facts"><div><div class="fact-label">项目类型</div><div class="fact-value">${esc(p.type||'未提供')}</div></div><div><div class="fact-label">项目来源</div><div class="fact-value">${esc(p.source||'未提供')}</div></div><div><div class="fact-label">所属大区</div><div class="fact-value">${esc(p.region)}</div></div><div><div class="fact-label">项目状态</div><div class="fact-value"><span class="tag ${statusClass(p.status)}">${esc(p.status)}</span></div></div><div><div class="fact-label">生态进度</div><div class="fact-value">${esc(p.eco||'—')}</div></div><div class="project-time-fact"><div class="fact-label">创建时间</div><div class="fact-value">${esc(p.created||'未提供')}</div></div><div class="project-time-fact"><div class="fact-label">更新时间</div><div class="fact-value">${esc(p.updated||'未提供')}</div></div><div class="project-team-fact"><div class="fact-label">项目成员</div><div class="fact-value project-team-values"><span>${personInfoMarkup(p.owner)}<span class="primary-person-tag" tabindex="0" aria-label="主负责人">主<span class="primary-person-tooltip" role="tooltip">主负责人</span></span></span>${[...new Set(p.members)].filter(name=>name!==p.owner).map(name=>`<span>、${personInfoMarkup(name)}</span>`).join('')}</div></div><div class="project-background-fact"><div class="fact-label">项目简介</div><div class="fact-value">${esc(p.background||'暂无项目简介')}</div></div></div></div><div class="project-summary-row"><section class="panel project-vehicle-summary"><h2>本项目车辆统计</h2>${projectVehicleStats(p)}</section><section class="panel stage-panel project-sales-stage"><div class="section-title"><div><h2>销售项目阶段</h2><p>当前阶段在新增跟进记录时维护，不由项目状态或生态进度自动驱动</p></div></div><div class="stage-flow">${stages.map((s,i)=>`<div class="stage-step ${i<idx?'done':i===idx?'current':''}"><div class="stage-node"></div><div>${s}</div></div>`).join('')}</div></section></div><section class="project-detail-content"><nav class="tabs" aria-label="项目详情内容">${Object.entries(tabs).map(([k,v])=>`<button class="tab ${state.detailTab===k?'active':''}" data-tab="${k}">${v}</button>`).join('')}</nav><div class="project-tab-content">${body}</div></section>`);
}

function customerList(){ const rows=visibleCustomers(); return shell(`${pageHead('客户管理',`${state.user.name}可见的客户档案`,canEdit()?`<button class="btn primary" data-go="/customers/new">${icons.plus}新建客户</button>`:'<span class="tag">只读视图</span>')}<section class="panel project-list-panel customer-list-panel"><div class="toolbar"><input class="input search" placeholder="搜索客户名称或联系人"><select class="select" style="width:auto"><option>全部行业</option><option>物流运输</option><option>港口物流</option></select><select class="select" style="width:auto"><option>全部大区</option><option>华东大区</option></select><button class="btn primary">${icons.search}查询</button><button type="button" class="btn" id="customer-reset">重置</button></div><div class="table-wrap responsive"><table><thead><tr><th>客户名称</th><th>所属行业</th><th>客户负责人</th><th>所属大区</th><th>主联系人</th><th class="num">关联项目</th><th>创建时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${rows.map(c=>`<tr><td class="object-cell"><div class="object-name" data-go="/customers/${c.id}">${esc(c.name)}</div><div class="object-meta">${c.id}</div></td><td>${esc(c.industry)}</td><td>${esc(c.owner)}</td><td>${esc(c.region)}</td><td>${esc(c.contact)}<div class="object-meta">${esc(c.title)} · ${esc(c.phone)}</div></td><td class="num">${customerProjectLinks(c)}</td><td>${esc(c.created||'未提供')}</td><td>${esc(c.updated||'未提供')}</td><td><button class="btn ghost small" data-go="/customers/${c.id}">查看</button>${canEdit()?`<button class="btn ghost small" data-go="/customers/${c.id}/edit">编辑</button>`:''}</td></tr>`).join('')}</tbody></table></div><div class="pagination"><span>共 ${rows.length} 条</span><div class="pages"><button class="page-btn active">1</button></div></div></section>`); }
function customerForm(id){ const c=customers.find(x=>x.id===id)||{}; return shell(`<div class="form-page ${id?'project-edit-page customer-edit-page':''}">${pageHead(`<button class="btn ghost small" data-go="${id?`/customers/${id}`:'/customers'}">${icons.back}<span>返回</span></button> ${id?'编辑客户':'新建客户'}`)}<form id="customer-form"><section class="form-section"><div class="section-title"><h2>基本信息</h2></div><div class="form-grid"><div class="field span-3"><label class="required">客户名称</label><input id="customer-name" class="input" value="${esc(c.name)}" placeholder="请输入工商登记名称"><div class="help">输入后将提示相似客户，不会自动合并。</div></div><div class="field"><label>所属行业 <span class="tag">演示字典</span></label><select class="select"><option>${c.industry||'请选择'}</option><option>物流运输</option><option>港口物流</option><option>大宗运输</option></select></div><div class="field"><label class="required">客户负责人</label><select class="select"><option>${c.owner||state.user.name}</option></select></div><div class="field"><label class="required">所属大区</label><select class="select"><option>${c.region||state.user.region}</option></select></div><div class="field"><label>注册资本</label><input class="input" value="${esc(c.capital)}" placeholder="例如 5,000万元人民币"></div></div></section><section class="form-section"><div class="section-title"><h2>核心工商与风险</h2></div><div class="form-grid"><div class="field span-2"><label>经营范围</label><textarea class="textarea">${esc(c.scope)}</textarea></div><div class="field"><label>实际控制人</label><input class="input" value="${esc(c.controller)}"></div><div class="field span-2"><label>风险信息</label><textarea class="textarea">${esc(c.risk)}</textarea></div><div class="field"><label>风险更新时间</label><input class="input" type="date" value="${c.riskDate||''}"></div></div></section><section class="form-section"><div class="section-title"><div><h2>联系人</h2><p>一个客户最多只有一名主联系人</p></div></div><div class="customer-section-actions"><button type="button" class="btn" id="add-contact">${icons.plus}新增联系人</button></div><div class="vehicle-editor"><div class="table-wrap"><table><thead><tr><th>姓名</th><th>职务</th><th>手机号</th><th>主联系人</th><th>操作</th></tr></thead><tbody id="contact-body"><tr><td>${c.contact||'待填写'}</td><td>${c.title||'—'}</td><td>${c.phone||'—'}</td><td><span class="tag success">主联系人</span></td><td><button type="button" class="btn ghost small">编辑</button></td></tr></tbody></table></div></div></section><section class="form-section"><div class="section-title"><h2>客户资料</h2></div><div class="customer-section-actions"><button type="button" class="btn" id="upload-file">${icons.plus}上传资料</button></div><div class="help">身份证明和银行流水可上传；本期所有资料使用同一权限模型，不做敏感分类。</div></section><div class="sticky-actions"><button type="button" class="btn" data-go="${id?`/customers/${id}`:'/customers'}">取消</button><button class="btn primary" type="submit">保存客户</button></div></form></div>`); }
function customerDetail(id){ const c=customers.find(x=>x.id===id); if(!c)return errorPage('404'); if(!visibleCustomers().includes(c))return errorPage('403'); const rel=visibleProjects().filter(p=>p.customer===c.short); return shell(`<div class="object-header project-object-header customer-object-header"><div class="object-header-top"><div><button class="btn ghost small" data-go="/customers">${icons.back}返回客户列表</button><h1 style="margin-top:12px">${esc(c.name)}</h1><div class="object-id">${c.id}</div></div><div class="head-actions">${canEdit()?`<button class="btn primary" data-go="/customers/${id}/edit">编辑客户</button>`:'<span class="tag">只读视图</span>'}</div></div><div class="facts">${[['所属行业',c.industry],['所属大区',c.region],['客户负责人',c.owner],['主联系人',[c.contact,c.title].filter(Boolean).join(' · ')],['创建时间',c.created],['更新时间',c.updated]].map(([label,value])=>`<div><div class="fact-label">${label}</div><div class="fact-value">${esc(value||'未提供')}</div></div>`).join('')}</div></div><section class="project-detail-content customer-detail-content"><nav class="tabs" role="tablist" aria-label="客户详情内容">${[['overview','客户概览'],['projects','关联项目'],['files','客户资料']].map(([key,label])=>`<button type="button" class="tab ${key==='overview'?'active':''}" role="tab" id="customer-tab-${key}" aria-controls="customer-panel-${key}" aria-selected="${key==='overview'}" tabindex="${key==='overview'?'0':'-1'}" data-customer-tab="${key}">${label}</button>`).join('')}</nav><div class="project-tab-content customer-tab-content"><div class="customer-tab-panel" id="customer-panel-overview" role="tabpanel" aria-labelledby="customer-tab-overview"><div class="detail-grid"><section class="panel detail-panel"><div class="section-title"><h2>核心工商与风险</h2></div><dl class="desc-list"><dt>注册资本</dt><dd>${esc(c.capital)}</dd><dt>经营范围</dt><dd>${esc(c.scope)}</dd><dt>实际控制人</dt><dd>${esc(c.controller)}</dd><dt>风险摘要</dt><dd>${esc(c.risk)}</dd><dt>风险更新</dt><dd>${esc(c.riskDate)}</dd></dl></section><aside class="panel detail-panel"><div class="section-title"><h2>联系人</h2></div>${customerContactsMarkup(c)}</aside></div></div><section class="panel detail-panel customer-tab-panel" id="customer-panel-projects" role="tabpanel" aria-labelledby="customer-tab-projects" hidden><div class="section-title"><div><h2>关联项目</h2><p>只显示当前用户有权查看的项目</p></div></div><div class="table-wrap"><table><thead><tr><th>项目</th><th>项目阶段</th><th>项目状态</th><th>负责人</th><th class="num">计划车辆</th><th class="num">已交付车辆</th><th class="num">计划挂车</th><th class="num">已交付挂车</th><th>操作</th></tr></thead><tbody>${rel.length?rel.map(p=>`<tr><td>${p.name}<div class="object-meta">${p.id}</div></td><td>${stageMarkup(p.stage)}</td><td><span class="tag ${statusClass(p.status)}">${p.status}</span></td><td>${esc(p.owner)}</td><td class="num">${p.tractor??0}</td><td class="num">${projectDeliveredText(p,'deliveredTractor')}</td><td class="num">${p.trailer??0}</td><td class="num">${projectDeliveredText(p,'deliveredTrailer')}</td><td><button class="btn ghost small" data-go="/projects/${p.id}">查看</button></td></tr>`).join(''):'<tr class="empty-row"><td colspan="9">暂无可见的关联项目</td></tr>'}</tbody></table></div></section><section class="panel detail-panel customer-tab-panel" id="customer-panel-files" role="tabpanel" aria-labelledby="customer-tab-files" hidden><div class="section-title"><h2>客户资料</h2></div><div class="file-row"><div class="file-icon">${icons.file}</div><div class="file-main"><div class="file-name">${esc(c.short)}基础资料.pdf</div><div class="file-meta">客户基础资料 · 1.8 MB</div></div><button class="btn ghost small" data-preview="0">预览</button></div></section></div></section>`); }

function vehicleRentalStatusMarkup(value){
  const status=vehicleRentalStatuses.find(item=>item.value===value);
  return `<span class="inventory-status-tag ${status?`status-${status.tone}`:'status-unknown'}">${esc(value||'未提供')}</span>`;
}
function vehicleAvailabilityStatusMarkup(kind,value){
  if(kind==='tractor') return vehicleRentalStatusMarkup(value);
  const status={可租:'available',在租:'rented'}[value];
  return `<span class="inventory-status-tag ${status?`status-${status}`:'status-unknown'}">${esc(value||'未提供')}</span>`;
}
function vehicleMetricCardsMarkup(cards,label){
  return `<section class="metric-section tractor-inventory-stats" aria-label="${esc(label)}"><div class="vehicle-metrics inventory-metrics ${cards.length===4?'compact-inventory-metrics':''}">${cards.map(([title,value,tone])=>`<article class="metric-card inventory-metric ${tone}"><div class="metric-main"><div class="metric-label"><span class="inventory-tone-marker" aria-hidden="true"></span>${esc(title)}</div><div class="metric-value">${value}</div></div></article>`).join('')}</div></section>`;
}
function tractorInventoryStatsMarkup(config){
  const cards=[['牵引车总数',config.sourceCount,'total'],...vehicleRentalStatuses.map(item=>[item.value,item.count,item.tone])];
  return vehicleMetricCardsMarkup(cards,'牵引车库存统计');
}
function trailerInventoryStatsMarkup(){
  const data=vehicleSourceAnalytics.trailer;
  return vehicleMetricCardsMarkup([
    ['挂车总数',data.total,'total'],
    ['在租',data.inRent,'rented'],
    ['未关联项目',data.unlinked,'unlinked'],
    ['检验预警',data.inspectionWarning,'repair']
  ],'挂车库存统计');
}
function vehicleDistributionMarkup(title,items,total,tone){
  const max=Math.max(...items.map(item=>item[1]),1);
  return `<section class="panel vehicle-analysis-card"><div class="vehicle-analysis-card-head"><h2>${esc(title)}</h2><span>虚构 DEMO 数据</span></div><div class="vehicle-distribution-list">${items.map(([name,count])=>`<div class="vehicle-distribution-row"><div class="vehicle-distribution-label"><span title="${esc(name)}">${esc(name)}</span><strong>${count}</strong></div><div class="vehicle-distribution-track"><span class="${tone}" style="width:${Math.max(4,Math.round(count/max*100))}%"></span></div><small>${Math.round(count/total*100)}%</small></div>`).join('')}</div></section>`;
}
function vehicleDonutMarkup(title,items,total,chartKey='trailer-types'){
  const colors=['#6fa8f5','#45c8a3','#9b8bea','#f4cf63','#f39a66','#b8bdc7'];
  return `<section class="panel vehicle-analysis-card vehicle-donut-card ${chartKey==='tractor-models'?'tractor-model-donut':''}"><div class="vehicle-analysis-card-head"><h2>${esc(title)}</h2><span>虚构 DEMO 数据</span></div><div class="vehicle-donut-layout"><canvas class="vehicle-donut-canvas" data-vehicle-donut="${esc(chartKey)}" width="176" height="176" role="img" aria-label="${esc(title)}：${items.map(([name,count])=>`${name} ${count}辆`).join('，')}"></canvas><div class="vehicle-donut-legend">${items.map(([name,count],index)=>`<div class="vehicle-donut-legend-item"><span class="vehicle-donut-swatch" style="--donut-color:${colors[index%colors.length]}" aria-hidden="true"></span><span class="vehicle-donut-name" title="${esc(name)}">${esc(name)}</span><strong>${count}</strong><small>${Math.round(count/total*100)}%</small></div>`).join('')}</div></div></section>`;
}
function vehicleRankingMarkup(title,items,nameLabel='品牌型号',valueLabel='车辆数'){
  const scrollable=items.length>=5;
  return `<section class="panel vehicle-analysis-card vehicle-ranking-card ${scrollable?'is-dense is-scrollable':''}"><div class="vehicle-analysis-card-head"><h2>${esc(title)}</h2><span>${items.length>5?'DEMO 数据 · 滚动查看更多':'虚构 DEMO 数据'}</span></div><div class="vehicle-ranking-head" aria-hidden="true"><span>序号</span><span>${esc(nameLabel)}</span><span>${esc(valueLabel)}</span></div><ol class="vehicle-ranking-list" aria-label="${esc(title)}" ${scrollable?'tabindex="0"':''}>${items.map(([name,count],index)=>`<li><span class="vehicle-ranking-number ${index<3?'is-top':''}">${index+1}</span><span class="vehicle-ranking-name" title="${esc(name)}">${esc(name)}</span><strong>${count}</strong></li>`).join('')}</ol></section>`;
}
function drawVehicleDonutCharts(){
  const charts={
    'trailer-types':[vehicleSourceAnalytics.trailer.types,vehicleSourceAnalytics.trailer.total],
    'tractor-models':[vehicleSourceAnalytics.tractor.models,vehicleSourceAnalytics.tractor.total]
  };
  const colors=['#6fa8f5','#45c8a3','#9b8bea','#f4cf63','#f39a66','#b8bdc7'];
  document.querySelectorAll('[data-vehicle-donut]').forEach(canvas=>{
    const [items,total]=charts[canvas.dataset.vehicleDonut]||[];
    if(!items||!total)return;
    const size=176,ratio=Math.max(1,window.devicePixelRatio||1),ctx=canvas.getContext('2d');
    canvas.width=size*ratio;canvas.height=size*ratio;canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;ctx.scale(ratio,ratio);
    const center=size/2,radius=72,lineWidth=30,gap=.018;
    ctx.clearRect(0,0,size,size);ctx.lineWidth=lineWidth;ctx.lineCap='butt';
    let start=-Math.PI/2;
    items.forEach(([name,count],index)=>{const angle=count/total*Math.PI*2;ctx.beginPath();ctx.strokeStyle=colors[index%colors.length];ctx.arc(center,center,radius,start+gap,start+angle-gap);ctx.stroke();start+=angle;});
  });
}
function vehicleAnalysisMarkup(kind){
  const data=vehicleSourceAnalytics[kind];
  const charts=kind==='tractor'
    ? vehicleDonutMarkup('车辆型号分布',data.models,data.total,'tractor-models')+vehicleRankingMarkup('当前所在地排行',data.locations,'当前所在地','车辆数')
    : vehicleDonutMarkup('车辆类型分布',data.types,data.total,'trailer-types')+vehicleRankingMarkup('品牌型号排行',data.brands);
  return `<div class="${kind==='tractor'?'tractor-analysis':'trailer-analysis'} vehicle-analysis-modules"><div class="vehicle-analysis-toggle-row"><button type="button" class="btn small" id="toggle-vehicle-analysis">${state.vehicleAnalysisCollapsed?'展开统计图表':'收起统计图表'}</button></div><div class="vehicle-analysis-cards ${state.vehicleAnalysisCollapsed?'is-collapsed':''}">${charts}</div></div>`;
}
function vehiclePlanPage(kind){
  const config=vehiclePlanConfigs[kind];
  const inventoryColumns=vehicleInventoryColumnIndexes(kind);
  const numberHeaders=new Set(['实际年龄','合格证年龄','融资金额','总质量（kg）','整备质量（kg）','核定载质量（kg）']);
  const renderCell=(value,column)=>`<td class="${numberHeaders.has(config.headers[column])?'num ':''}${config.primaryIndexes.includes(column)?'plan-project-name':''}" title="${esc(value||'')}">${config.headers[column]==='可租状态'?vehicleAvailabilityStatusMarkup(kind,value):(value===''||value===null||value===undefined?'—':esc(value))}</td>`;
  const body=config.rows.map((row,index)=>{const linked=projects.find(project=>project.id===row.linkedProjectId),vehicleName=row.cells[config.displayNameIndex]||row.cells[0],linkedMarkup=`<td class="plan-linked-project">${linked?`<button type="button" class="plan-project-link" data-go="/projects/${linked.id}" title="${esc(linked.name)}">${esc(linked.name)}</button><div class="object-meta">${linked.id}</div>`:'<span class="plan-unlinked">未关联</span>'}</td>`,cells=`${renderCell(row.cells[0],0)}${linkedMarkup}${inventoryColumns.filter(column=>column!==0).map(column=>renderCell(row.cells[column],column)).join('')}`;return `<tr data-plan-row="${index}"><td class="plan-select-cell"><input type="checkbox" data-plan-select="${index}" aria-label="选择车辆${esc(vehicleName)}" ${canEdit()?'':'disabled'}></td>${cells}${kind==='tractor'?`<td class="plan-updated-at">${esc(row.updatedAt||initialVehicleImportTime)}</td>`:''}</tr>`;}).join('');
  const actions=`${canEdit()?'<button type="button" class="btn primary" id="batch-link-project" disabled>批量关联项目</button>':'<span class="tag">只读视图</span>'}${canEdit()?'<button type="button" class="btn" id="import-vehicle-inventory">导入</button>':''}<button type="button" class="btn" id="export-vehicle-inventory">导出</button><button type="button" class="btn" id="vehicle-refresh">刷新</button>`;
  const statusFilter=kind==='tractor'?`<details class="inventory-status-filter"><summary><span id="inventory-status-filter-label">全部可租状态</span><span aria-hidden="true">⌄</span></summary><div class="inventory-status-options" role="group" aria-label="筛选可租状态">${vehicleRentalStatuses.map(item=>`<label><input type="checkbox" data-vehicle-status="${item.value}" aria-label="${item.value}" ${state.vehicleStatusFilter.includes(item.value)?'checked':''}><span>${item.value}</span><strong>${item.count}</strong></label>`).join('')}</div></details>`:'';
  const optionMarkup=index=>[...new Set(config.rows.map(row=>String(row.cells[index]||'')).filter(Boolean))].map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
  const tractorFilters=kind==='tractor'?`<div class="vehicle-plan-query-bar"><label class="vehicle-query-field"><span>VIN码</span><input class="input" id="vehicle-vin-search" placeholder="请输入 VIN 码"></label><label class="vehicle-query-field"><span>车牌号</span><input class="input" id="vehicle-plate-search" placeholder="请输入车牌号"></label><label class="vehicle-query-field"><span>当前所在地</span><select class="select" id="vehicle-location-filter"><option value="">全部所在地</option>${optionMarkup(2)}</select></label><label class="vehicle-query-field"><span>经销商</span><select class="select" id="vehicle-dealer-filter"><option value="">全部经销商</option>${optionMarkup(20)}</select></label><label class="vehicle-query-field"><span>上牌方</span><select class="select" id="vehicle-registration-filter"><option value="">全部上牌方</option>${optionMarkup(21)}</select></label><label class="vehicle-query-field vehicle-project-query"><span>关联项目</span><select class="select" id="vehicle-project-filter"><option value="">全部关联项目</option><option value="__unlinked__">未关联</option>${permittedProjects().map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join('')}</select></label><div class="vehicle-query-field vehicle-status-query"><span>可租状态</span>${statusFilter}</div><button type="button" class="btn primary vehicle-query-search" id="vehicle-search-btn">${icons.search}搜索</button><button type="button" class="btn vehicle-query-reset" id="vehicle-filter-reset">重置</button></div>`:'';
  const trailerFilters=kind==='trailer'?`<div class="vehicle-plan-query-bar vehicle-trailer-query-bar"><label class="vehicle-query-field"><span>VIN码</span><input class="input" id="trailer-vin-search" placeholder="请输入 VIN 码"></label><label class="vehicle-query-field"><span>资产所属</span><select class="select" id="trailer-asset-filter"><option value="">全部资产所属</option>${optionMarkup(1)}</select></label><label class="vehicle-query-field"><span>车牌号</span><input class="input" id="trailer-plate-search" placeholder="请输入车牌号"></label><label class="vehicle-query-field"><span>车辆类型</span><select class="select" id="trailer-type-filter"><option value="">全部车辆类型</option>${optionMarkup(3)}</select></label><label class="vehicle-query-field"><span>品牌型号</span><select class="select" id="trailer-brand-filter"><option value="">全部品牌型号</option>${optionMarkup(4)}</select></label><label class="vehicle-query-field"><span>可租状态</span><select class="select" id="trailer-rental-filter"><option value="">全部可租状态</option>${optionMarkup(7)}</select></label><label class="vehicle-query-field vehicle-project-query"><span>关联项目</span><select class="select" id="trailer-project-filter"><option value="">全部关联项目</option><option value="__unlinked__">未关联</option>${permittedProjects().map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join('')}</select></label><button type="button" class="btn primary vehicle-query-search" id="vehicle-search-btn">${icons.search}搜索</button><button type="button" class="btn vehicle-query-reset" id="vehicle-filter-reset">重置</button></div>`:'';
  const generalSearch='';
  const orderedHeaders=`<th>${config.headers[0]}</th><th>关联项目</th>${inventoryColumns.filter(column=>column!==0).map(column=>`<th class="${numberHeaders.has(config.headers[column])?'num':''}">${config.headers[column]}</th>`).join('')}${kind==='tractor'?'<th>更新时间</th>':''}`;
  const pageTitle=kind==='tractor'?'牵引车管理':'挂车管理';
  const inventoryStats=kind==='tractor'?tractorInventoryStatsMarkup(config):trailerInventoryStatsMarkup();
  return shell(`${pageHead(pageTitle,config.description,'')}${inventoryStats}${vehicleAnalysisMarkup(kind)}<section class="panel vehicle-plan-panel">${generalSearch?`<div class="vehicle-plan-toolbar">${generalSearch}</div>`:''}${tractorFilters}${trailerFilters}<div class="vehicle-plan-table-actions"><div class="vehicle-plan-action-buttons">${actions}</div><div class="vehicle-plan-summary"><strong id="plan-selected-count">未选择车辆</strong></div></div><div class="table-wrap vehicle-plan-table-wrap"><table class="vehicle-plan-table"><thead><tr><th class="plan-select-cell"><input type="checkbox" id="plan-select-all" aria-label="全选当前库存车辆" ${canEdit()?'':'disabled'}></th>${orderedHeaders}</tr></thead><tbody>${body}</tbody></table></div><div class="pagination"><span id="vehicle-pagination-count">展示 ${config.rows.length} 条样例 · 共 ${config.sourceCount} 辆</span><div class="pages"><button class="page-btn active">1</button></div></div></section>`);
}
function inventoryCsvCell(value){
  let text=value===null||value===undefined?'':String(value);
  if(/^[=+@]/.test(text)||/^-\D/.test(text))text=`'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
function exportVehicleInventory(kind){
  const config=vehiclePlanConfigs[kind],inventoryColumns=vehicleInventoryColumnIndexes(kind),headers=[config.headers[0],'关联项目编号','关联项目名称',...inventoryColumns.filter(column=>column!==0).map(column=>config.headers[column]),...(kind==='tractor'?['更新时间']:[])];
  const rows=config.rows.map(row=>{const linked=projects.find(project=>project.id===row.linkedProjectId);return [row.cells[0],linked?.id||'',linked?.name||'',...inventoryColumns.filter(column=>column!==0).map(column=>row.cells[column]),...(kind==='tractor'?[row.updatedAt||initialVehicleImportTime]:[])];});
  const csv='\ufeff'+[headers,...rows].map(row=>row.map(inventoryCsvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`${config.title}-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`已导出 ${rows.length} 辆车，包含关联项目`);
}
function parseInventoryCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=String(text).replace(/^\ufeff/,'');
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted){if(char==='"'&&text[index+1]==='"'){cell+='"';index++;}else if(char==='"')quoted=false;else cell+=char;}
    else if(char==='"')quoted=true;
    else if(char===','){row.push(cell);cell='';}
    else if(char==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=char;
  }
  row.push(cell.replace(/\r$/,''));if(row.some(value=>value!==''))rows.push(row);
  return rows;
}
function importVehicleInventoryCsv(kind,text){
  const config=vehiclePlanConfigs[kind],matrix=parseInventoryCsv(text),headers=matrix.shift()||[];
  const indexes=new Map(headers.map((header,index)=>[header.trim(),index]));
  const inventoryColumns=vehicleInventoryColumnIndexes(kind),missing=inventoryColumns.map(column=>config.headers[column]).filter(header=>!indexes.has(header));
  if(missing.length)throw new Error(`缺少字段：${missing.slice(0,3).join('、')}${missing.length>3?' 等':''}`);
  const permitted=permittedProjects(),projectIdIndex=indexes.get('关联项目编号'),projectNameIndex=indexes.get('关联项目名称');
  let created=0,updated=0,linked=0;const importedAt=vehicleInventoryTimestamp();
  matrix.filter(source=>source.some(value=>value.trim())).forEach(source=>{
    const cells=config.headers.map(()=>(''));
    inventoryColumns.forEach(column=>{cells[column]=source[indexes.get(config.headers[column])]?.trim()||'';});
    if(!cells[0])return;
    let row=config.rows.find(item=>String(item.cells[0])===cells[0]);
    if(row){row.cells=cells;row.updatedAt=importedAt;updated++;}else{row={id:`${config.route}-import-${Date.now()}-${created}`,cells,linkedProjectId:'',updatedAt:importedAt};config.rows.push(row);config.sourceCount++;created++;}
    const projectId=projectIdIndex===undefined?'':source[projectIdIndex]?.trim();
    const projectName=projectNameIndex===undefined?'':source[projectNameIndex]?.trim();
    const project=permitted.find(item=>item.id===projectId)||(projectName?permitted.find(item=>item.name===projectName):null);
    if(project){row.linkedProjectId=project.id;linked++;}
  });
  render();toast(`导入完成：新增 ${created} 辆，更新 ${updated} 辆，恢复 ${linked} 条项目关联`);
}
function openVehicleInventoryImport(kind){
  const config=vehiclePlanConfigs[kind];
  modal(`导入${config.title}`,`<div class="inventory-import-note"><strong>导入规则</strong><p>库存字段需与当前表头一致；项目关系统一使用“关联项目编号”和“关联项目名称”。CSV 将按 VIN 更新或新增车辆。</p></div><label class="inventory-import-zone" for="inventory-import-file"><strong>选择 Excel 或 CSV 文件</strong><span class="inventory-import-file">支持 .xlsx、.xls、.csv</span><input id="inventory-import-file" type="file" accept=".xlsx,.xls,.csv" hidden></label><div class="field-error" id="inventory-import-error" role="alert"></div>`,'开始导入',()=>{
    const file=$('#inventory-import-file')?.files?.[0],error=$('#inventory-import-error');
    if(!file){error.textContent='请先选择要导入的文件。';return false;}
    if(file.name.toLowerCase().endsWith('.csv')){
      file.text().then(text=>{try{importVehicleInventoryCsv(kind,text);}catch(importError){toast(importError.message,'error');}});
    }else{
      toast('Excel 文件已接收；正式环境将由导入服务解析并校验关联项目');
    }
  });
  $('#inventory-import-file')?.addEventListener('change',event=>{const file=event.target.files?.[0];$('.inventory-import-file').textContent=file?`${file.name} · ${(file.size/1024).toFixed(1)} KB`:'支持 .xlsx、.xls、.csv';$('#inventory-import-error').textContent='';});
}
function openVehicleProjectLinker(kind,indexes){
  const config=vehiclePlanConfigs[kind],available=permittedProjects();
  const names=indexes.map(index=>config.rows[index].cells[config.displayNameIndex]||config.rows[index].cells[0]);
  modal('批量关联项目',`<div class="batch-link-summary"><strong>已选择 ${indexes.length} 辆车</strong><p>${names.slice(0,3).map(esc).join('、')}${names.length>3?` 等 ${names.length} 辆`:''}</p></div><div class="field"><label class="required" for="batch-project-select">关联项目</label><select class="select" id="batch-project-select"><option value="">请选择项目</option>${available.map(project=>`<option value="${project.id}">${esc(project.name)}（${project.id}）</option>`).join('')}</select><div class="field-error" id="batch-project-error"></div><div class="help">项目名称与项目编号将统一更新为同一条关联项目数据。</div></div>`,'确认关联',()=>{
    const projectId=$('#batch-project-select').value;
    if(!projectId){$('#batch-project-error').textContent='请选择要关联的项目。';$('#batch-project-select').focus();return false;}
    const updatedAt=vehicleInventoryTimestamp();indexes.forEach(index=>{config.rows[index].linkedProjectId=projectId;config.rows[index].updatedAt=updatedAt;});
    render();toast(`已将 ${indexes.length} 辆车关联到项目`);
  });
}
function bindVehiclePlanActions(){
  const match=/^\/vehicles\/(tractors|trailers)$/.exec(currentRoute());
  if(!match)return;
  const kind=match[1]==='tractors'?'tractor':'trailer';
  const config=vehiclePlanConfigs[kind],selectAll=$('#plan-select-all'),checkboxes=$$('[data-plan-select]'),batch=$('#batch-link-project'),count=$('#plan-selected-count'),statusCheckboxes=$$('[data-vehicle-status]');
  const update=()=>{const selected=checkboxes.filter(input=>input.checked&&!input.closest('tr').hidden);if(batch)batch.disabled=!selected.length;if(count)count.textContent=selected.length?`已选择 ${selected.length} 辆`:'未选择车辆';if(selectAll){const visible=checkboxes.filter(input=>!input.closest('tr').hidden);selectAll.checked=visible.length>0&&visible.every(input=>input.checked);selectAll.indeterminate=selected.length>0&&!selectAll.checked;}};
  selectAll?.addEventListener('change',()=>{checkboxes.filter(input=>!input.closest('tr').hidden).forEach(input=>{input.checked=selectAll.checked;});update();});
  checkboxes.forEach(input=>input.addEventListener('change',update));
  const applyFilters=()=>{const keyword=$('#vehicle-plan-search')?.value.trim().toLowerCase()||'',vin=$('#vehicle-vin-search')?.value.trim().toLowerCase()||'',plate=$('#vehicle-plate-search')?.value.trim().toLowerCase()||'',location=$('#vehicle-location-filter')?.value||'',dealer=$('#vehicle-dealer-filter')?.value||'',registration=$('#vehicle-registration-filter')?.value||'',projectFilter=$('#vehicle-project-filter')?.value||'',selectedStatuses=new Set(state.vehicleStatusFilter);let visibleCount=0;$$('[data-plan-row]').forEach(row=>{const item=config.rows[Number(row.dataset.planRow)],cells=item.cells,searchMatch=!keyword||config.searchIndexes.some(column=>String(cells[column]||'').toLowerCase().includes(keyword)),vinMatch=!vin||String(cells[0]||'').toLowerCase().includes(vin),plateMatch=!plate||String(cells[1]||'').toLowerCase().includes(plate),locationMatch=!location||String(cells[2]||'')===location,dealerMatch=!dealer||String(cells[20]||'')===dealer,registrationMatch=!registration||String(cells[21]||'')===registration,projectMatch=!projectFilter||(projectFilter==='__unlinked__'?!item.linkedProjectId:item.linkedProjectId===projectFilter),statusMatch=kind!=='tractor'||selectedStatuses.has(String(cells[7]||''));row.hidden=!(searchMatch&&vinMatch&&plateMatch&&locationMatch&&dealerMatch&&registrationMatch&&projectMatch&&statusMatch);if(!row.hidden)visibleCount++;});const label=$('#inventory-status-filter-label');if(label)label.textContent=state.vehicleStatusFilter.length===vehicleRentalStatuses.length?'全部状态':`已选 ${state.vehicleStatusFilter.length} 项`;const pagination=$('#vehicle-pagination-count');if(pagination)pagination.textContent=`展示 ${visibleCount} 条样例 · 共 ${config.sourceCount} 辆`;update();};
  const applyTrailerFilters=()=>{const vin=$('#trailer-vin-search')?.value.trim().toLowerCase()||'',asset=$('#trailer-asset-filter')?.value||'',plate=$('#trailer-plate-search')?.value.trim().toLowerCase()||'',type=$('#trailer-type-filter')?.value||'',brand=$('#trailer-brand-filter')?.value||'',rental=$('#trailer-rental-filter')?.value||'',projectFilter=$('#trailer-project-filter')?.value||'';let visibleCount=0;$$('[data-plan-row]').forEach(row=>{const item=config.rows[Number(row.dataset.planRow)],cells=item.cells,projectMatch=!projectFilter||(projectFilter==='__unlinked__'?!item.linkedProjectId:item.linkedProjectId===projectFilter),matches=(!vin||String(cells[0]||'').toLowerCase().includes(vin))&&(!asset||String(cells[1]||'')===asset)&&(!plate||String(cells[2]||'').toLowerCase().includes(plate))&&(!type||String(cells[3]||'')===type)&&(!brand||String(cells[4]||'')===brand)&&(!rental||String(cells[7]||'')===rental)&&projectMatch;row.hidden=!matches;if(!row.hidden)visibleCount++;});const pagination=$('#vehicle-pagination-count');if(pagination)pagination.textContent=`展示 ${visibleCount} 条样例 · 共 ${config.sourceCount} 辆`;update();};
  const activeApply=kind==='trailer'?applyTrailerFilters:applyFilters;
  ['#vehicle-plan-search','#vehicle-vin-search','#vehicle-plate-search','#trailer-vin-search','#trailer-plate-search'].forEach(selector=>$(selector)?.addEventListener('input',activeApply));
  $('#vehicle-search-btn')?.addEventListener('click',activeApply);
  ['#vehicle-project-filter','#vehicle-location-filter','#vehicle-dealer-filter','#vehicle-registration-filter'].forEach(selector=>$(selector)?.addEventListener('change',applyFilters));
  statusCheckboxes.forEach(input=>input.addEventListener('change',()=>{state.vehicleStatusFilter=statusCheckboxes.filter(item=>item.checked).map(item=>item.dataset.vehicleStatus);applyFilters();}));
  $('#vehicle-filter-reset')?.addEventListener('click',()=>{['#vehicle-vin-search','#vehicle-plate-search','#trailer-vin-search','#trailer-plate-search'].forEach(selector=>{const input=$(selector);if(input)input.value='';});['#vehicle-project-filter','#vehicle-location-filter','#vehicle-dealer-filter','#vehicle-registration-filter','#trailer-asset-filter','#trailer-project-filter','#trailer-type-filter','#trailer-brand-filter','#trailer-rental-filter'].forEach(selector=>{const input=$(selector);if(input)input.value='';});statusCheckboxes.forEach(input=>{input.checked=true;});state.vehicleStatusFilter=vehicleRentalStatuses.map(item=>item.value);activeApply();});
  batch?.addEventListener('click',()=>openVehicleProjectLinker(kind,checkboxes.filter(input=>input.checked&&!input.closest('tr').hidden).map(input=>Number(input.dataset.planSelect))));
  $('#import-vehicle-inventory')?.addEventListener('click',()=>openVehicleInventoryImport(kind));
  $('#export-vehicle-inventory')?.addEventListener('click',()=>exportVehicleInventory(kind));
  $('#vehicle-refresh')?.addEventListener('click',()=>{render();toast('车辆列表已刷新');});
  const projectId=currentHashParams().get('project'),projectFilter=$(kind==='trailer'?'#trailer-project-filter':'#vehicle-project-filter');
  if(projectId&&projectFilter&&[...projectFilter.options].some(option=>option.value===projectId))projectFilter.value=projectId;
  activeApply();
}
function usersPage(){ return shell(`${pageHead('用户管理','管理登录账号、组织信息、多角色和所属大区','<button class="btn primary" id="create-user">'+icons.plus+'创建用户</button>')}<section class="panel"><div class="toolbar"><input class="input search" placeholder="搜索姓名、登录账号或部门"><select class="select" style="width:auto"><option>全部角色</option><option>销售人员</option></select><select class="select" style="width:auto"><option>全部账号状态</option><option>启用</option><option>停用</option></select></div><div class="table-wrap"><table><thead><tr><th>姓名 / 账号</th><th>部门</th><th>职位</th><th>角色</th><th>所属大区</th><th>数据范围</th><th>账号状态</th><th>最近登录</th><th>操作</th></tr></thead><tbody>${users.map(u=>{const self=u.account===state.user?.account;const statusTone=u.status==='启用'?'success':'warning';return `<tr><td class="object-cell"><div class="object-name">${esc(u.name)}</div><div class="object-meta">${esc(u.account)}</div></td><td>${esc(u.department||'未提供')}</td><td>${esc(u.position||'未提供')}</td><td>${esc(u.role)}</td><td>${esc(u.region)}</td><td>${esc(u.scope)}</td><td><span class="tag ${statusTone}">${esc(u.status)}</span></td><td>${esc(u.last)}</td><td>${self?'<button class="btn ghost small" disabled title="不可编辑当前账号">编辑</button><button class="btn ghost small" disabled title="不可停用当前账号">停用</button>':`<button class="btn ghost small" data-edit-user="${esc(u.account)}">编辑</button><button class="btn ghost small" data-disable-user="${esc(u.account)}">${u.status==='停用'?'启用':'停用'}</button>`}</td></tr>`;}).join('')}</tbody></table></div></section>`); }
function openCreateUser(){
  modal('创建用户',`<div class="user-create-grid"><div class="field"><label class="required" for="new-user-name">姓名</label><input class="input" id="new-user-name" placeholder="请输入姓名"></div><div class="field"><label class="required" for="new-user-account">登录账号</label><input class="input" id="new-user-account" placeholder="请输入登录账号"></div><div class="field"><label for="new-user-department">部门</label><input class="input" id="new-user-department" placeholder="选填"></div><div class="field"><label for="new-user-position">职位</label><input class="input" id="new-user-position" placeholder="选填"></div><div class="field span-2"><label class="required" for="new-user-role">角色</label><select class="select" id="new-user-role"><option value="">请选择角色</option><option>销售人员</option><option>大区总监</option><option>最高管理层</option><option>系统管理员</option></select></div></div><div class="field-error" id="new-user-error" role="alert"></div>`,'创建用户',()=>{
    const name=$('#new-user-name').value.trim(),account=$('#new-user-account').value.trim(),department=$('#new-user-department').value.trim(),position=$('#new-user-position').value.trim(),role=$('#new-user-role').value;
    const controls=[$('#new-user-name'),$('#new-user-account'),$('#new-user-role')];
    controls.forEach(control=>control.setAttribute('aria-invalid',String(!control.value.trim())));
    if(!name||!account||!role){$('#new-user-error').textContent='请填写姓名、登录账号和角色。';controls.find(control=>!control.value.trim())?.focus();return false;}
    if(users.some(user=>user.account===account)){$('#new-user-account').setAttribute('aria-invalid','true');$('#new-user-error').textContent='该登录账号已存在，请更换后重试。';$('#new-user-account').focus();return false;}
    users.push({name,account,department,position,role,region:'—',scope:'待配置',status:'启用',last:'从未登录'});
    render();toast('用户已创建');
  });
}
function openEditUser(account){
  const user=users.find(item=>item.account===account); if(!user)return;
  modal('编辑用户',`<div class="user-create-grid"><div class="field"><label>姓名</label><input class="input" id="edit-user-name" value="${esc(user.name)}"></div><div class="field"><label>登录账号</label><input class="input" value="${esc(user.account)}" disabled></div><div class="field"><label for="edit-user-department">部门</label><input class="input" id="edit-user-department" value="${esc(user.department||'')}"></div><div class="field"><label for="edit-user-position">职位</label><input class="input" id="edit-user-position" value="${esc(user.position||'')}"></div><div class="field span-2"><label for="edit-user-role">角色</label><select class="select" id="edit-user-role">${['销售人员','大区总监','最高管理层','系统管理员'].map(role=>`<option ${user.role===role?'selected':''}>${role}</option>`).join('')}</select></div></div>`,'保存修改',()=>{user.name=$('#edit-user-name').value.trim()||user.name;user.department=$('#edit-user-department').value.trim();user.position=$('#edit-user-position').value.trim();user.role=$('#edit-user-role').value;render();toast('用户信息已更新');});
}
function rolesPage(){ const groups=[['客户',['查看','新建','编辑']],['项目',['查看','新建','编辑','分配负责人','推进阶段','阶段纠错/降级']],['车辆需求',['查看','新增','编辑','删除']],['资料',['上传','预览','下载','删除']],['统计',['查看']]], roles=['销售人员','大区总监','最高管理层','系统管理员'], selected=state.roleEditorRole||'大区总监'; return shell(`${pageHead('角色管理与权限配置','多角色权限取有效角色合集，首版不设拒绝权限','')}<div class="roles-card"><aside class="role-list-panel"><div class="section-title"><h2>预置角色</h2></div>${roles.map(r=>`<button class="nav-item role-select ${selected===r?'active':''}" data-role-select="${r}"><span>${r}</span></button>`).join('')}</aside><section class="role-permission-panel"><div class="section-title"><div><h2>${selected}</h2><p>默认数据范围：${selected==='大区总监'?'所属大区':'—'}</p>${selected==='大区总监'?'<span class="tag warning role-impact-note">修改将影响 2 名已分配用户</span>':''}</div></div>${groups.map(g=>`<div class="form-section"><strong>${g[0]}</strong><div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px">${g[1].map((p,i)=>`<label><input type="checkbox" ${g[0]!=='统计'||i===0?'checked':''}> ${p}</label>`).join('')}</div></div>`).join('')}<div class="role-save-row"><button class="btn primary" id="save-role">保存权限</button></div></section></div>`); }
function regionsPage(){ const rows=[{name:'华东大区',director:'赵敏',sales:['林晨','周琪'],projects:['杭州城市配送二期项目','沪甬跨区干线一期项目','临港港区车队合作项目','沪杭干线运输签约项目']},{name:'华南大区',director:'刘帆',sales:['陈航'],projects:['深圳盐田港新能源牵引项目','深圳盐田港示范车队项目']},{name:'华北大区',director:'待分配',sales:['王磊'],projects:['鄂尔多斯矿区封闭运输项目']},{name:'西南大区',director:'待分配',sales:['李敏'],projects:['成渝绿色物流示范项目']}]; return shell(`${pageHead('大区管理','首版使用扁平大区，不建设多级组织树','<button class="btn primary" id="create-region">'+icons.plus+'新建大区</button>')}<section class="panel"><div class="table-wrap"><table><thead><tr><th>大区名称</th><th>状态</th><th>大区总监</th><th class="num">销售人数</th><th class="num">关联项目</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="object-name">${r.name}</td><td><span class="tag success">启用</span></td><td>${r.director}</td><td class="num"><span class="region-hover" data-tooltip="${esc(r.sales.join('、'))}">${r.sales.length}</span></td><td class="num"><span class="region-hover" data-tooltip="${esc(r.projects.join('、'))}">${r.projects.length}</span></td><td><button class="btn ghost small" data-edit-region="${esc(r.name)}">编辑</button><button class="btn ghost small" data-stop-region="${esc(r.name)}">停用</button></td></tr>`).join('')}</tbody></table></div></section>`); }
function errorPage(type){ const map={403:['无权限访问','当前账号没有查看该内容的权限，如需访问请联系系统管理员。'],404:['页面不存在','该页面可能已移动、删除或地址输入有误。'],500:['系统暂时无法响应','服务遇到异常，请稍后重试。已填写的内容不会被清空。']}[type]||['页面异常','请稍后重试']; const content=`<div class="state-page"><div><div class="state-visual">${type==='403'?icons.shield:type==='500'?icons.warn:icons.search}</div><h1>${map[0]}</h1><p>${map[1]}</p><button class="btn primary" data-go="${isAdmin()?'/users':'/projects'}">返回${isAdmin()?'用户':'项目'}管理</button></div></div>`; return state.user?shell(content):content; }

function render(){
  let route=currentRoute();
  if(!state.user && route!=='/login'){go('/login');return;}
  if(state.user && route==='/login'){go(isAdmin()?'/users':'/projects');return;}
  let html='';
  if(route==='/login') html=loginPage();
  else if(isAdmin() && !['/users','/roles','/regions','/403','/404','/500'].includes(route)) html=errorPage('403');
  else if(route==='/projects') html=projectList();
  else if(route==='/projects/new') html=canEdit()?projectForm():errorPage('403');
  else if(/^\/projects\/[^/]+\/edit$/.test(route)) html=canEdit()?projectForm(route.split('/')[2]):errorPage('403');
  else if(window.CalculationApp?.matchCalculationRoute(route)){
    const calcHtml=window.CalculationApp.renderCalculationRoute(route);
    if(calcHtml===null) return;
    html=calcHtml;
  }
  else if(/^\/projects\/[^/]+$/.test(route)) html=projectDetail(route.split('/')[2]);
  else if(route==='/customers') html=customerList();
  else if(route==='/customers/new') html=canEdit()?customerForm():errorPage('403');
  else if(/^\/customers\/[^/]+\/edit$/.test(route)){ const c=customers.find(c=>c.id===route.split('/')[2]); html=!c?errorPage('404'):canEdit()&&visibleCustomers().includes(c)?customerForm(c.id):errorPage('403'); }
  else if(/^\/customers\/[^/]+$/.test(route)) html=customerDetail(route.split('/')[2]);
  else if(route==='/vehicles/tractors') html=vehiclePlanPage('tractor');
  else if(route==='/vehicles/trailers') html=vehiclePlanPage('trailer');
  else if(route==='/users') html=isAdmin()?usersPage():errorPage('403');
  else if(route==='/roles') html=isAdmin()?rolesPage():errorPage('403');
  else if(route==='/regions') html=isAdmin()?regionsPage():errorPage('403');
  else if(route==='/403') html=errorPage('403'); else if(route==='/500') html=errorPage('500'); else html=errorPage('404');
  $('#app').innerHTML=html;
  if(route==='/login') $('.login-stat strong').textContent=projects.length;
  drawVehicleDonutCharts();
  bind();
}

function modal(title,body,confirm='确认',onConfirm=()=>{}){ const trigger=document.activeElement; const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="btn ghost small" data-close>${icons.close}<span class="sr-only">关闭</span></button></div><div class="modal-body">${body}</div><div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" data-confirm>${confirm}</button></div></div>`;document.body.append(wrap);const close=()=>{wrap.remove();if(trigger?.isConnected)trigger.focus();};$('[data-close]',wrap).focus();$$('[data-close]',wrap).forEach(b=>b.onclick=close);$('[data-confirm]',wrap).onclick=()=>{if(onConfirm()!==false)close();};wrap.onclick=e=>{if(e.target===wrap)close();};wrap.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=$$('button,input,select,textarea',wrap).filter(el=>!el.disabled);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}; }
function bind(){
  bindVehiclePlanActions();
  window.CalculationApp?.bindCalculationActions?.();
  $('#toggle-vehicle-analysis')?.addEventListener('click',()=>{state.vehicleAnalysisCollapsed=!state.vehicleAnalysisCollapsed;render();});
  const projectDetailId=/^\/projects\/([^/]+)$/.exec(currentRoute())?.[1];
  if(projectDetailId)bindProjectDocumentActions(projectDetailId);
  $('#customer-reset')?.addEventListener('click',()=>{
    const toolbar=$('#customer-reset').closest('.toolbar');
    toolbar.querySelector('input').value='';
    toolbar.querySelectorAll('select').forEach(select=>{select.selectedIndex=0;});
  });
  bindCustomerProjectLinks();
  const customerTabs=$$('[data-customer-tab]');
  customerTabs.forEach((button,index)=>{
    button.onclick=()=>{
      customerTabs.forEach(tab=>{const active=tab===button;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;});
    };
    button.onkeydown=event=>{let target;if(event.key==='ArrowRight')target=(index+1)%customerTabs.length;else if(event.key==='ArrowLeft')target=(index+customerTabs.length-1)%customerTabs.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=customerTabs.length-1;else return;event.preventDefault();customerTabs[target].click();customerTabs[target].focus();};
  });
  $$('[data-add-project-visit]').forEach(button=>button.onclick=()=>openProjectVisitEditor(button.dataset.addProjectVisit));
  $$('[data-copy-project-address]').forEach(button=>button.onclick=async()=>{
    const p=permittedProjects().find(project=>project.id===button.dataset.copyProjectAddress);
    if(!p?.place)return;
    try {
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(p.place);
      else {
        const input=document.createElement('textarea');input.value=p.place;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();
        try { if(!document.execCommand('copy'))throw new Error('复制失败'); } finally { input.remove();button.focus(); }
      }
      toast('项目地址已复制');
    } catch(error) { toast('复制失败，请手动选择地址复制','error'); }
  });
  bindDemoStateTool();
  $$('[data-ranking-kind]').forEach(b=>b.onclick=()=>{rankingKind=b.dataset.rankingKind;render();$('[data-ranking-kind="'+rankingKind+'"]')?.focus();});
  $('#toggle-charts')?.addEventListener('click',()=>{chartsExpanded=!chartsExpanded;render();$('#toggle-charts')?.focus();});
  prepareProjectForm();
  prepareContactDraft();
  bindCustomerContactDetailActions();
  $$('[data-edit-demand]').forEach(b=>b.onclick=()=>openDemandEditor(b.dataset.editDemand));
  $$('.table-wrap.responsive table').forEach(table=>{
    const labels=$$('thead th',table).map(th=>th.textContent.trim());
    $$('tbody tr',table).forEach(row=>$$('td',row).forEach((cell,i)=>cell.dataset.label=labels[i]||''));
  });
  syncTableFreezeState();
  $$('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
  $('#logout')?.addEventListener('click',()=>{state.user=null;go('/login')});
  $$('.account-btn').forEach(b=>b.onclick=()=>{state.user=users.find(u=>u.account===b.dataset.account);go(isAdmin()?'/users':'/projects')});
  $('#login-form')?.addEventListener('submit',e=>{e.preventDefault();const account=$('#account').value.trim(),pass=$('#password').value;if(!account||!pass){$('#app').innerHTML=loginPage('请填写登录账号和密码');bind();return}const u=users.find(x=>x.account===account);if(!u){$('#app').innerHTML=loginPage('账号或密码错误');bind();return}if(u.status==='停用'){$('#app').innerHTML=loginPage('该账号已停用，请联系系统管理员');bind();return}state.user=u;go(isAdmin()?'/users':'/projects')});
  $$('[data-stage]').forEach(b=>b.onclick=()=>{state.stage=state.stage===b.dataset.stage?'':b.dataset.stage;render()});
  $$('[data-status]').forEach(b=>b.onclick=()=>{state.status=state.status===b.dataset.status?'':b.dataset.status;render()});
  $('#search-btn')?.addEventListener('click',()=>{state.keyword=$('#project-search').value;state.customerFilter=$('#project-customer-filter').value;state.ownerFilter=$('#project-owner-filter').value;state.region=$('#region-filter').value;state.stage=$('#stage-filter').value;render()});
  $('#project-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('#search-btn').click()});
  $$('[data-reset]').forEach(b=>b.onclick=()=>{state.keyword=state.stage=state.status=state.region=state.customerFilter=state.ownerFilter='';state.viewState='normal';render()});
  $$('[data-retry]').forEach(b=>b.onclick=()=>{state.viewState='loading';render();setTimeout(()=>{state.viewState='normal';render();toast('项目数据已恢复')},700)});
  $('#view-state')?.addEventListener('change',e=>{state.viewState=e.target.value;render()}); if($('#view-state'))$('#view-state').value=state.viewState;
  $$('[data-tab]').forEach(b=>b.onclick=()=>{state.detailTab=b.dataset.tab;render()});
  $('#project-form')?.addEventListener('submit',saveProjectForm);
  $('#customer-form')?.addEventListener('submit',saveCustomerWithContacts);
  $('#add-vehicle')?.addEventListener('click',()=>editVehicle());
  bindVehicleActions();
  $('#upload-file')?.addEventListener('click',()=>modal('上传资料',`<div class="field"><label class="required">资料类别</label><select class="select"><option>项目方案</option><option>身份证明</option><option>财务资料</option><option>其他</option></select></div><div class="field" style="margin-top:14px"><label class="required">选择文件</label><div class="panel" style="padding:24px;text-align:center">${icons.file}<p>选择演示文件</p><div class="help">文件格式和大小限制待实现前确认</div></div></div><label style="display:flex;gap:8px;align-items:center;margin-top:14px"><input id="simulate-upload-fail" type="checkbox"> 演示“上传失败与重试”状态</label>`,'开始上传',()=>{const failed=$('#simulate-upload-fail')?.checked;toast(failed?'文件上传失败，请检查网络后重试':'文件上传成功',failed?'error':'success')}));
  $$('[data-preview]').forEach((b,i)=>b.onclick=()=>i%2?modal('文件预览失败',`暂时无法加载该文件。您可以重试，或下载后查看。`,'重试',()=>toast('正在重新加载预览')):toast('文件预览已打开'));
  $$('[data-delete-file]').forEach(b=>b.onclick=()=>modal('删除资料',`确定删除“${b.dataset.deleteFile}”吗？删除后将保留基础操作记录。`,'确认删除',()=>toast('资料已删除')));
  $('#add-contact')?.addEventListener('click',()=>openContactEditor());
  $('#create-user')?.addEventListener('click',openCreateUser);
  $$('[data-edit-user]').forEach(b=>b.onclick=()=>openEditUser(b.dataset.editUser));
  $$('[data-disable-user]').forEach(b=>b.onclick=()=>{const user=users.find(item=>item.account===b.dataset.disableUser);if(!user)return;const disabling=user.status!=='停用';modal(disabling?'停用账号':'启用账号',disabling?`停用“${user.name}”后，该账号将无法登录，已有会话会立即失效。`:`恢复“${user.name}”后，该账号可以重新登录。`,disabling?'确认停用':'确认启用',()=>{user.status=disabling?'停用':'启用';render();toast(disabling?'账号已停用':'账号已启用');})});
  $('#save-role')?.addEventListener('click',()=>toast('角色权限已保存，将在用户下一次请求时生效'));
  $('#create-region')?.addEventListener('click',()=>modal('新建大区','<div class="field"><label class="required">大区名称</label><input class="input" placeholder="请输入大区名称"></div>','新建大区',()=>toast('大区已新建')));
  $$('[data-edit-region]').forEach(b=>b.onclick=()=>modal('编辑大区',`<div class="field"><label class="required">大区名称</label><input class="input" value="${esc(b.dataset.editRegion)}"></div><div class="field" style="margin-top:14px"><label>大区总监</label><input class="input" placeholder="请输入大区总监"></div>`,'保存修改',()=>toast('大区信息已更新')));
  $$('[data-stop-region]').forEach(b=>b.onclick=()=>modal('无法停用大区',`“${b.dataset.stopRegion}”仍被用户、客户或项目引用。请先完成数据调整后再停用。`,'我知道了',()=>{}));
  $$('[data-role-select]').forEach(b=>b.onclick=()=>{state.roleEditorRole=b.dataset.roleSelect;render();});
}

function syncTableFreezeState(){
  $$('.table-wrap').forEach(wrap=>wrap.classList.toggle('has-horizontal-scroll',wrap.scrollWidth>wrap.clientWidth+1));
  if(!window.__tableFreezeResizeBound){
    window.__tableFreezeResizeBound=true;
    window.addEventListener('resize',syncTableFreezeState);
  }
}
function registerWebMCP(){
  const context=document.modelContext;
  if(!context?.registerTool) return;
  const report=error=>console.warn('WebMCP tool registration failed',error);
  Promise.resolve(context.registerTool({
    name:'read_visible_projects', title:'读取当前可见项目',
    description:'返回当前演示身份与页面筛选后的项目摘要，不修改界面数据。',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,untrustedContentHint:false},
    execute(){ return {count:visibleProjects().length,projects:visibleProjects().map(p=>({id:p.id,name:p.name,stage:p.stage,status:p.status,ecoProgress:p.eco}))}; }
  })).catch(report);
  Promise.resolve(context.registerTool({
    name:'apply_project_filters', title:'应用项目筛选',
    description:'在项目管理页应用阶段、状态或关键词筛选，并同步刷新顶部统计与列表。',
    inputSchema:{type:'object',properties:{keyword:{type:'string'},stage:{type:'string',enum:stages},status:{type:'string',enum:statuses}},additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input={}){ if(!state.user||isAdmin()) throw new Error('当前身份不可访问项目数据'); if(input.keyword!==undefined&&typeof input.keyword!=='string') throw new Error('关键词必须是文本'); if(input.stage&&!stages.includes(input.stage)) throw new Error('项目阶段不在允许范围内'); if(input.status&&!statuses.includes(input.status)) throw new Error('项目状态不在允许范围内'); state.keyword=input.keyword||'';state.stage=input.stage||'';state.status=input.status||'';go('/projects');render();return {applied:true,resultCount:visibleProjects().length}; }
  })).catch(report);
}
initializeVehicleData();
window.addEventListener('hashchange',render);
registerWebMCP();
render();
const customerIdentityIcon='<svg class="customer-identity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
function ensureCustomerIdentityIcon(){ $$('.customer-object-header .object-id:not(.customer-identity)').forEach(el=>{el.classList.add('customer-identity');el.insertAdjacentHTML('afterbegin',customerIdentityIcon);}); }
new MutationObserver(ensureCustomerIdentityIcon).observe(document.body,{childList:true,subtree:true});
ensureCustomerIdentityIcon();

const customerAddressIcon='<svg class="customer-address-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const customerAddressCopyIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg>';
function ensureCustomerAddress(){
  $$('.customer-object-header .customer-identity').forEach(idEl=>{
    if(idEl.querySelector('.customer-address')){
      const existingButton=idEl.querySelector('[data-copy-customer-address]');
      if(existingButton&&!existingButton.dataset.bound){
        const customer=customers.find(item=>item.id===idEl.textContent.trim());
        existingButton.addEventListener('click',async()=>{try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(customer.address);else{const input=document.createElement('textarea');input.value=customer.address;input.style.position='fixed';input.style.opacity='0';input.style.pointerEvents='none';document.body.append(input);input.select();if(!document.execCommand('copy'))throw new Error('复制失败');input.remove();}toast('公司地址已复制');existingButton.focus();}catch{toast('复制失败，请重试','error');}});
        existingButton.dataset.bound='true';
      }
      return;
    }
    const customer=customers.find(item=>item.id===idEl.textContent.trim());
    if(!customer?.address)return;
    idEl.insertAdjacentHTML('beforeend',`<span class="customer-address" aria-label="公司地址">${customerAddressIcon}<span>${esc(customer.address)}</span><button type="button" class="address-copy" data-copy-customer-address="${esc(customer.id)}" aria-label="复制公司地址" title="复制公司地址">${customerAddressCopyIcon}</button></span>`);
    const button=idEl.querySelector('[data-copy-customer-address]');
    button.addEventListener('click',async()=>{try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(customer.address);else{const input=document.createElement('textarea');input.value=customer.address;input.style.position='fixed';input.style.opacity='0';input.style.pointerEvents='none';document.body.append(input);input.select();if(!document.execCommand('copy'))throw new Error('复制失败');input.remove();}toast('公司地址已复制');button.focus();}catch{toast('复制失败，请重试','error');}});
    button.dataset.bound='true';
  });
}
new MutationObserver(ensureCustomerAddress).observe(document.body,{childList:true,subtree:true});
ensureCustomerAddress();
