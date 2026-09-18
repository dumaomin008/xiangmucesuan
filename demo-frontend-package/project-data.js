// 本轮只提供会话内业务模拟，不持久化真实资料或提供服务端鉴权。
let chartsExpanded=true;
let demoToolPosition=null;
const customerDocumentTypes=['营业执照','公司章程','资质证书（道路运输许可证）','实控人身份证','实控人简历','银行流水','财务报表','纳税申报表','固定资产','企业及法人征信报告','其他资料'];
// 项目资料按业务阶段拆分，保留已有的业务证明与其他资料，并补充项目报告、经营测算报告。
const projectDocumentTypes=['业务证明（上下游合同）','项目报告','经营测算报告','其他资料'];
const customerMetricIcon='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M16 11a3.5 3.5 0 1 0 0-7M18 15a4 4 0 0 1 3 3.87V21"/></svg>';
const projectMetricIconMarkup='<svg class="project-management-icon" viewBox="0 0 1256 1024" fill="currentColor" aria-hidden="true"><path d="M960.6144 883.92192h-133.96992a33.32608 33.32608 0 0 1-33.31584-33.31584v-134.0416-0.14848a33.3056 33.3056 0 0 1 33.31584-33.3056h133.9648a33.536 33.536 0 0 1 33.38752 33.4592v133.90336a33.52576 33.52576 0 0 1-33.37728 33.4592h-0.00512z m0-251.05408h-133.96992a33.31072 33.31072 0 0 1-33.31584-33.3056V465.70496v-0.13824a33.31584 33.31584 0 0 1 33.31584-33.31584h133.9648a33.52064 33.52064 0 0 1 33.38752 33.44384v133.65248a33.51552 33.51552 0 0 1-33.37728 33.52576h-0.00512z m0-251.02336h-133.96992a33.31584 33.31584 0 0 1-33.31584-33.3056v-134.0416-0.1536a33.31584 33.31584 0 0 1 33.31584-33.31584h133.9648a33.54112 33.54112 0 0 1 33.38752 33.46944v133.90336a33.53088 33.53088 0 0 1-33.37728 33.44896h-0.00512z m-251.27936 502.07744H575.64672a33.60256 33.60256 0 0 1-33.59744-33.4592v-133.90336a33.60256 33.60256 0 0 1 33.59744-33.4592h133.82656a33.5872 33.5872 0 0 1 33.59232 33.4592v133.90336a33.60256 33.60256 0 0 1-33.59232 33.4592h-0.14848 0.01024z m0-251.05408H324.51072a33.51552 33.51552 0 0 1-33.38752-33.52576V214.49728a33.52576 33.52576 0 0 1 33.37728-33.4592h384.97792a33.5872 33.5872 0 0 1 33.59232 33.4592v384.7936a33.5872 33.5872 0 0 1-33.59232 33.57696h-0.14848 0.00512z m-384.82432 50.23744h133.9648a33.3056 33.3056 0 0 1 33.31584 33.3056v134.18496a33.32608 33.32608 0 0 1-33.31584 33.31584H324.51072a33.52576 33.52576 0 0 1-33.38752-33.4592v-133.888a33.53088 33.53088 0 0 1 33.37728-33.46944h0.01024z"/></svg>';
const documentCardIcon='<svg class="icon" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true"><path d="M279.552 93.184v791.552c0 16.384-3.072 31.744-8.192 46.08h613.376c25.6 0 46.08-20.48 46.08-46.08V93.184H279.552z m-93.184 372.736V0H1024v884.736c0 76.8-62.464 139.264-139.264 139.264H139.264C62.464 1024 0 961.536 0 884.736V465.92h186.368z m-93.184 92.16v325.632c0 25.6 20.48 46.08 46.08 46.08s46.08-20.48 46.08-46.08V558.08h-92.16z m325.632 47.104V512h372.736v93.184H418.816z m0-186.368v-93.184h372.736v93.184H418.816z"/></svg>';
const tractorTypeIcon='<svg class="icon vehicle-source-icon tractor-source-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M133.12 265.728v-14.336H63.488v67.584H41.472c-8.192 0-14.336 6.656-14.336 14.336v104.96c0 8.192 6.656 14.336 14.336 14.336h55.296c8.192 0 14.336-6.656 14.336-14.336V333.824c0-8.192-6.656-14.336-14.336-14.336h-18.432V265.728H133.12zM886.784 265.728v-14.336h69.12v67.584h22.528c8.192 0 14.336 6.656 14.336 14.336v104.96c0 8.192-6.656 14.336-14.336 14.336h-55.296c-8.192 0-14.336-6.656-14.336-14.336V333.824c0-8.192 6.656-14.336 14.336-14.336h18.432V265.728h-54.784z" /><path d="M904.704 701.952h-10.752V162.816c0-44.032-36.352-79.36-79.36-79.36H212.48c-44.032 0-79.36 36.352-79.36 79.36v539.648h-10.752c-20.992 0-38.4 17.408-38.4 38.4v77.824c0 20.992 17.408 38.4 38.4 38.4h13.824v88.064c0 14.336 12.288 26.624 26.624 26.624h79.36c14.336 0 26.624-11.776 26.624-26.624V890.88h500.224v54.272c0 14.336 12.288 26.624 26.624 26.624h79.36c14.336 0 26.624-11.776 26.624-26.624v-88.576h3.072c20.992 0 38.4-17.408 38.4-38.4v-77.824c0-20.992-17.408-38.4-38.4-38.4z m-31.744 47.616c4.096 0 8.192 3.584 8.192 8.192v38.4c0 4.096-3.584 8.192-8.192 8.192H788.48c-4.096 0-8.192-3.584-8.192-8.192V757.76c0-4.096 3.584-8.192 8.192-8.192h84.48zM203.776 283.136c0-15.36 12.288-27.648 27.648-27.648h565.248c15.36 0 27.648 12.288 27.648 27.648v163.84c0 15.36-12.288 27.648-27.648 27.648H231.424c-15.36 0-27.648-12.288-27.648-27.648v-163.84z m197.12 307.2v-43.52h224.768v43.52H400.896z m224.768 48.128v43.52H400.896v-43.52h224.768zM145.92 757.76c0-4.096 3.584-8.192 8.192-8.192h84.48c4.096 0 8.192 3.584 8.192 8.192v38.4c0 4.096-3.584 8.192-8.192 8.192H154.112c-4.096 0-8.192-3.584-8.192-8.192V757.76z m58.368-77.824c-4.096 0-8.192-3.584-8.192-8.192v-70.656c0-4.096 3.584-8.192 8.192-8.192h119.296c4.096 0 8.192 3.584 8.192 8.192v70.656c0 4.096-3.584 8.192-8.192 8.192H204.288z m521.728 117.76h-424.96v-43.52h424.96v43.52z m-22.016-117.76c-4.096 0-8.192-3.584-8.192-8.192v-70.656c0-4.096 3.584-8.192 8.192-8.192h119.296c4.096 0 8.192 3.584 8.192 8.192v70.656c0 4.096-3.584 8.192-8.192 8.192h-119.296z" /></svg>';
const projectDocuments={
  'PRJ-DEMO-001':{
    '业务证明（上下游合同）':{name:'临港港区运输合同.pdf',size:'3.2 MB',uploader:'陈航',uploadedAt:'2026-09-10'},
    '其他资料':{name:'临港港区场景照片.zip',size:'18.4 MB',uploader:'陈航',uploadedAt:'2026-09-10'}
  }
};
function projectDocumentsMarkup(project) {
  const files=projectDocuments[project.id]||{};
  const uploaded=projectDocumentTypes.filter(type=>files[type]).length;
  const customer=customers.find(item=>item.short===project.customer||item.name===project.customer);
  const customerFiles=customer?customerDocumentSetFor(customer):{};
  const customerUploaded=customerDocumentTypes.filter(type=>customerFiles[type]).length;
  const projectCards=projectDocumentTypes.map(type=>{
    const file=files[type];
    const title=esc(type).replace(/（([^）]+)）/g,'<span class="document-card-title-muted">（$1）</span>');
    return `<article class="document-card ${file?'is-uploaded':'is-empty'}"><div class="document-card-head"><div class="document-card-title"><span class="document-card-icon" aria-hidden="true">${documentCardIcon}</span><h3>${title}</h3></div><span class="document-status ${file?'success':'missing'}">${file?'已上传':'待上传'}</span></div>${file?`<div class="document-file"><strong title="${esc(file.name)}">${esc(file.name)}</strong><span>${esc(file.size)} · ${esc(file.uploader)}上传于 ${esc(file.uploadedAt)}</span></div><div class="document-card-actions"><button type="button" class="btn ghost small" data-project-doc-preview="${esc(type)}">预览</button><button type="button" class="btn ghost small" data-project-doc-download="${esc(type)}">下载</button>${canEdit()?`<button type="button" class="btn ghost small danger" data-project-doc-delete="${esc(type)}">删除</button><button type="button" class="btn ghost small" data-project-doc-upload="${esc(type)}">重新上传</button>`:''}</div>`:canEdit()?`<button type="button" class="document-upload-zone" data-project-doc-upload="${esc(type)}"><span class="document-upload-plus" aria-hidden="true">${icons.plus}</span><strong>点击上传资料</strong><span>支持 PDF、Word、Excel、图片，单个文件不超过 20 MB</span></button>`:'<div class="document-upload-zone is-disabled"><strong>尚未上传该类资料</strong><span>当前角色无上传权限</span></div>'}</article>`;
  }).join('');
  const customerCards=customerDocumentTypes.map(type=>{
    const file=customerFiles[type];
    const title=esc(type).replace(/（([^）]+)）/g,'<span class="document-card-title-muted">（$1）</span>');
    return `<article class="document-card is-synced ${file?'is-uploaded':'is-empty'}"><div class="document-card-head"><div class="document-card-title"><span class="document-card-icon" aria-hidden="true">${documentCardIcon}</span><h3>${title}</h3></div><span class="document-status ${file?'success':'missing'}">${file?'已上传':'待上传'}</span></div>${file?`<div class="document-file"><strong title="${esc(file.name)}">${esc(file.name)}</strong><span>${esc(file.size)} · ${esc(file.uploader)}上传于 ${esc(file.uploadedAt)}</span></div><div class="document-synced-footer"><div class="document-sync-copy">同步自客户资料</div><div class="document-card-actions"><button type="button" class="btn ghost small" data-synced-doc-preview="${esc(type)}">预览</button></div></div>`:'<div class="document-empty-copy">关联客户尚未上传该类资料</div><div class="document-synced-footer"><div class="document-sync-copy">同步自客户资料</div></div>'}</article>`;
  }).join('');
  return `<section class="panel detail-panel project-documents"><div class="section-title"><div><h2>项目资料</h2><p>已上传 ${uploaded}/${projectDocumentTypes.length} 类资料；在项目详情中维护</p></div></div><div class="document-card-grid">${projectCards}</div><div class="section-title synced-document-title"><div><h2>关联客户资料</h2><p>${customer?`已同步 ${customerUploaded}/${customerDocumentTypes.length} 类资料，来源：${esc(customer.short)}；仅作展示，请在客户详情中维护`:'未找到关联客户，暂无法同步客户资料'}</p></div></div><div class="document-card-grid synced-document-grid">${customerCards}</div></section>`;
}
function openProjectDocumentUpload(projectId,type) {
  modal(projectDocuments[projectId]?.[type]?'重新上传资料':'上传资料',`<div class="field"><label>资料类别</label><input class="input" value="${esc(type)}" disabled></div><div class="field" style="margin-top:14px"><label class="required" for="project-document-file">选择文件</label><input class="input" id="project-document-file" type="file" required><div class="help">原型环境仅记录文件名，不会上传真实文件。</div></div><div class="field-error" id="project-document-error" role="alert"></div>`,'上传',()=>{
    const input=$('#project-document-file'),file=input.files?.[0];
    if(!file){$('#project-document-error').textContent='请选择需要上传的文件';return false;}
    if(file.size>20*1024*1024){$('#project-document-error').textContent='单个文件不能超过 20 MB';return false;}
    projectDocuments[projectId]??={};
    projectDocuments[projectId][type]={name:file.name,size:file.size?Math.max(1,Math.round(file.size/1024))+' KB':'未知大小',uploader:state.user.name,uploadedAt:nowText().slice(0,10)};
    render();toast('资料已上传');
  });
}
function bindProjectDocumentActions(projectId) {
  $$('[data-project-doc-upload]').forEach(button=>button.onclick=()=>openProjectDocumentUpload(projectId,button.dataset.projectDocUpload));
  $$('[data-project-doc-preview]').forEach(button=>button.onclick=()=>toast('已打开“'+projectDocuments[projectId][button.dataset.projectDocPreview].name+'”预览'));
  $$('[data-project-doc-download]').forEach(button=>button.onclick=()=>toast('已开始下载“'+projectDocuments[projectId][button.dataset.projectDocDownload].name+'”'));
  $$('[data-synced-doc-preview]').forEach(button=>button.onclick=()=>{
    const project=projects.find(item=>item.id===projectId);
    const customer=project&&customers.find(item=>item.short===project.customer||item.name===project.customer);
    const file=customer&&customerDocumentSetFor(customer)[button.dataset.syncedDocPreview];
    if(file)toast('已打开“'+file.name+'”预览');
  });
  $$('[data-project-doc-delete]').forEach(button=>button.onclick=()=>{
    const type=button.dataset.projectDocDelete,file=projectDocuments[projectId]?.[type];
    modal('删除资料',`确定删除“${esc(file?.name||type)}”吗？删除后该资料类别将恢复为待上传状态。`,'确认删除',()=>{
      delete projectDocuments[projectId][type];render();toast('资料已删除');
    });
  });
}
const customerDocuments={
  'CUST-001':{
    '营业执照':{name:'东澜绿色物流营业执照.pdf',size:'1.4 MB',uploader:'陈航',uploadedAt:'2026-09-10'}
  }
};
function customerDocumentSetFor(customer) {
  customerDocuments[customer.id]??={};
  return customerDocuments[customer.id];
}
function customerDocumentsMarkup(customer) {
  const files=customerDocumentSetFor(customer);
  const uploaded=customerDocumentTypes.filter(type=>files[type]).length;
  return `<div class="section-title"><div><h2>企业资料</h2><p>已上传 ${uploaded}/${customerDocumentTypes.length} 类资料；文件操作继承客户数据权限</p></div></div><div class="document-card-grid customer-document-card-grid">${customerDocumentTypes.map(type=>{
    const file=files[type];
    const title=esc(type).replace(/（([^）]+)）/g,'<span class="document-card-title-muted">（$1）</span>');
    return `<article class="document-card ${file?'is-uploaded':'is-empty'}"><div class="document-card-head"><div class="document-card-title"><span class="document-card-icon" aria-hidden="true">${documentCardIcon}</span><h3>${title}</h3></div><span class="document-status ${file?'success':'missing'}">${file?'已上传':'待上传'}</span></div>${file?`<div class="document-file"><strong title="${esc(file.name)}">${esc(file.name)}</strong><span>${esc(file.size)} · ${esc(file.uploader)}上传于 ${esc(file.uploadedAt)}</span></div><div class="document-card-actions"><button type="button" class="btn ghost small" data-customer-doc-preview="${esc(type)}">预览</button><button type="button" class="btn ghost small" data-customer-doc-download="${esc(type)}">下载</button>${canEdit()?`<button type="button" class="btn ghost small danger" data-customer-doc-delete="${esc(type)}">删除</button><button type="button" class="btn ghost small" data-customer-doc-upload="${esc(type)}">重新上传</button>`:''}</div>`:canEdit()?`<button type="button" class="document-upload-zone" data-customer-doc-upload="${esc(type)}"><span class="document-upload-plus" aria-hidden="true">${icons.plus}</span><strong>点击上传资料</strong><span>支持 PDF、Word、Excel、图片，单个文件不超过 20 MB</span></button>`:'<div class="document-upload-zone is-disabled"><strong>尚未上传该类资料</strong><span>当前角色无上传权限</span></div>'}</article>`;
  }).join('')}</div>`;
}
function openCustomerDocumentUpload(customer,type) {
  const files=customerDocumentSetFor(customer);
  modal(files[type]?'重新上传资料':'上传资料',`<div class="field"><label>资料类别</label><input class="input" value="${esc(type)}" disabled></div><div class="field" style="margin-top:14px"><label class="required" for="customer-document-file">选择文件</label><input class="input" id="customer-document-file" type="file" required><div class="help">原型环境仅记录文件名，不会上传真实文件。</div></div><div class="field-error" id="customer-document-error" role="alert"></div>`,'上传',()=>{
    const input=$('#customer-document-file'),file=input.files?.[0];
    if(!file){$('#customer-document-error').textContent='请选择需要上传的文件';return false;}
    if(file.size>20*1024*1024){$('#customer-document-error').textContent='单个文件不能超过 20 MB';return false;}
    files[type]={name:file.name,size:file.size?Math.max(1,Math.round(file.size/1024))+' KB':'未知大小',uploader:state.user.name,uploadedAt:nowText().slice(0,10)};
    renderCustomerDocumentsPanel(customer);toast('客户资料已上传');
  });
}
function bindCustomerDocumentActions(customer,panel) {
  const files=customerDocumentSetFor(customer);
  $$('[data-customer-doc-preview]',panel).forEach(button=>button.onclick=()=>toast('已打开“'+files[button.dataset.customerDocPreview].name+'”预览'));
  $$('[data-customer-doc-download]',panel).forEach(button=>button.onclick=()=>toast('已开始下载“'+files[button.dataset.customerDocDownload].name+'”'));
  $$('[data-customer-doc-upload]',panel).forEach(button=>button.onclick=()=>openCustomerDocumentUpload(customer,button.dataset.customerDocUpload));
  $$('[data-customer-doc-delete]',panel).forEach(button=>button.onclick=()=>{
    const type=button.dataset.customerDocDelete,file=files[type];
    modal('删除资料',`确定删除“${esc(file?.name||type)}”吗？删除后该资料类别将恢复为待上传状态。`,'确认删除',()=>{
      delete files[type];renderCustomerDocumentsPanel(customer);toast('客户资料已删除');
    });
  });
}
function renderCustomerDocumentsPanel(customer) {
  const panel=$('#customer-panel-files');if(!panel)return;
  panel.classList.add('customer-documents');
  panel.innerHTML=customerDocumentsMarkup(customer);
  panel.dataset.documentCards='true';
  bindCustomerDocumentActions(customer,panel);
}
function configureCustomerDetailTabs() {
  const tablist=$('[aria-label="客户详情内容"]');
  const overview=$('#customer-tab-overview'),files=$('#customer-tab-files'),projects=$('#customer-tab-projects');
  if(!tablist||!overview||!files||!projects)return;
  if(overview.textContent!=='客户信息')overview.textContent='客户信息';
  if(files.textContent!=='企业资料')files.textContent='企业资料';
  if(files.nextElementSibling!==projects)tablist.insertBefore(files,projects);
}
function syncCustomerTypes() {
  customers.forEach(customer=>{
    if(customer.customerType==='正式客户')return;
    const trigger=projects.find(project=>(project.customer===customer.short||project.customer===customer.name)&&stages.indexOf(project.stage)>=stages.indexOf('90%签约落地'));
    if(trigger) {
      customer.customerType='正式客户';
      customer.officialProjectId??=trigger.id;
      customer.officialAt??=(trigger.updated||trigger.created||nowText()).slice(0,10);
    } else customer.customerType??='潜在客户';
  });
}
function customerTypeMarkup(customer) {
  const formal=customer.customerType==='正式客户';
  const trace=formal&&customer.officialProjectId?`由 ${customer.officialProjectId} 于 ${customer.officialAt||'未记录日期'} 触发转为正式客户`:'尚无关联项目达到 90%签约落地';
  return `<span class="tag customer-type-tag ${formal?'formal':'potential'}" title="${esc(trace)}">${esc(customer.customerType)}</span>`;
}
function enhanceCustomerTypes() {
  syncCustomerTypes();
  const route=(location.hash||'').replace(/^#/,'');
  if(route==='/customers') {
    const table=$('.customer-list-panel table');
    if(!table||table.dataset.customerTypeColumn)return;
    const industryHead=table.querySelector('thead th:nth-child(2)');
    industryHead?.insertAdjacentHTML('afterend','<th>客户类型</th>');
    table.querySelectorAll('tbody tr').forEach(row=>{
      const id=row.querySelector('.object-meta')?.textContent.trim(),customer=customers.find(item=>item.id===id),industryCell=row.children[1];
      if(customer&&industryCell)industryCell.insertAdjacentHTML('afterend',`<td data-label="客户类型">${customerTypeMarkup(customer)}</td>`);
    });
    table.dataset.customerTypeColumn='true';
  }
  const detailMatch=/^\/customers\/([^/]+)$/.exec(route);
  if(detailMatch) {
    const customer=customers.find(item=>item.id===detailMatch[1]),facts=$('.customer-object-header .facts');
    if(customer&&facts&&!facts.querySelector('.customer-type-fact')) {
      const regionFact=[...facts.children].find(item=>item.querySelector('.fact-label')?.textContent.replace('：','').trim()==='所属大区');
      (regionFact||facts.firstElementChild)?.insertAdjacentHTML('afterend',`<div class="customer-type-fact"><div class="fact-label">客户类型</div><div class="fact-value">${customerTypeMarkup(customer)}</div></div>`);
    }
  }
}
const customerMetricIcons={"total":"<svg viewBox=\"0 0 1269 1024\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M362.084632 451.950615c18.727062 0 33.294896-2.075275 47.863971-8.293661-47.86397-51.819885-79.077393-124.357807-79.077394-201.041321 0-53.890201 14.567834-105.703888 39.538077-151.301668h-8.324654c-99.883449 0-181.043555 80.835302-181.043555 180.320804s81.160106 180.315845 181.043555 180.315846z m697.123746 511.937078c0 18.652679 0 60.101149-60.351571 60.10115h-728.32973c-60.344133 0-60.344133-41.44847-60.344133-60.10115 0-232.136971 191.445963-422.814314 424.511477-422.814314s424.513956 190.679823 424.513957 422.814314z m-905.220256-29.017896H60.349093A60.274709 60.274709 0 0 1-0.001239 874.761209c0-201.0438 162.314014-362.705726 362.085871-362.705726 27.051716 0 54.107151 4.14931 81.160107 8.293661C280.928245 590.815511 162.312775 746.257811 153.988122 934.869797z m782.443079-694.32448c0-53.884003-14.569074-105.69893-39.538077-151.29547h8.325894c99.88097 0 181.041076 80.829104 181.041075 180.314606s-81.160106 180.315845-181.041075 180.315846c-14.569074 0-33.297376-6.218386-47.86521-8.292422 49.940485-49.739652 79.077393-122.283772 79.077393-201.04256z m332.955161 634.215892a60.27099 60.27099 0 0 1-60.349092 60.108588h-93.647706c-12.483881-186.535471-126.933925-344.054286-291.331892-412.451576 27.054195-6.218386 54.107151-8.292421 81.161346-8.292422C1107.071108 512.055483 1269.386362 673.71741 1269.386362 874.761209zM411.593698 332.549169a240.6513 240.6513 0 1 0 31.498556-238.378912A241.258758 241.258758 0 0 0 411.593698 332.549169z m0 0\" fill=\"currentColor\" /></svg>","formal":"<svg viewBox=\"0 0 1206 1024\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M853.836181 998.354744H21.550636q30.17089-153.569829 94.865897-204.77414 64.695008-51.20431 250.116677-136.544827l116.459635 226.15237 21.550635-55.471336-34.481017-68.272413 64.651907-68.272414 64.738109 68.272414-30.17089 72.539439 17.240509 55.471336 120.683559-226.15237q21.593737 8.534052 56.117855 25.602155c-21.550636 34.136207-34.481017 72.539439-34.481017 115.209698 4.310127 85.340517 56.031652 157.836855 124.993686 196.240088z m-310.458456-358.38707c-150.940652 0-254.469905-204.774139-254.469904-315.716811s0-302.915734 254.469904-302.915734c254.426804 0 254.426804 196.240088 254.426804 302.915734 0 110.942672-103.486152 315.716811-254.426804 315.716811z\"  /><path d=\"M983.226197 597.297416c112.149508 0 207.015405 93.874569 207.015406 204.81724s-94.865898 204.774139-207.015406 204.774139c-112.106406 0-206.972304-93.831467-206.972304-204.774139 0-110.942672 94.865898-204.817241 206.972304-204.81724z m112.149508 123.743749c4.310127-8.534052 4.310127-12.801078 0-17.068103q-8.620254-8.534052-17.240508 0l-120.769762 106.675646-56.031653-42.670259c-8.620254-8.534052-17.240508-4.267026-17.240508 0q-8.663356 8.534052 0 17.068104l60.341779 81.03039q12.930381 17.111205 25.860763 0l125.079889-145.035778z\"  /></svg>","potential":"<svg viewBox=\"0 0 1024 1024\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M502.496 63.136c125.888 0 227.936 100.384 227.936 224.192 0 123.84-102.048 224.224-227.936 224.224-125.888 0-227.936-100.384-227.936-224.224C274.56 163.488 376.64 63.136 502.496 63.136L502.496 63.136zM502.496 63.136c125.888 0 227.936 100.384 227.936 224.192 0 123.84-102.048 224.224-227.936 224.224-125.888 0-227.936-100.384-227.936-224.224C274.56 163.488 376.64 63.136 502.496 63.136L502.496 63.136zM417.024 586.304l189.984 0c162.624 0 294.432 129.632 294.432 289.6l0 18.656c0 63.04-131.84 65.44-294.432 65.44l-189.984 0c-162.624 0-294.432-0.096-294.432-65.44l0-18.656C122.592 715.936 254.4 586.304 417.024 586.304L417.024 586.304zM417.024 586.304\" fill=\"currentColor\" /></svg>"};
function enhanceCustomerListMetrics() {
  if((location.hash||'').replace(/^#/,'')!=='/customers'||$('.customer-metric-section'))return;
  const main=$('#main-content'),head=main?.querySelector('.page-head');
  if(!main||!head)return;
  syncCustomerTypes();
  const rows=visibleCustomers(),formal=rows.filter(item=>item.customerType==='正式客户').length,potential=rows.length-formal;
  const card=(label,value,note,tone)=>`<article class="metric-card"><div class="metric-main"><div class="metric-label">${label}</div><div class="metric-value">${value}<small class="metric-unit">个</small></div></div><div class="metric-icon ${tone}" aria-hidden="true">${customerMetricIcons[tone.replace('customers-','')]}</div><div class="metric-note">${note}</div></article>`;
  head.insertAdjacentHTML('afterend',`<section class="metric-section customer-metric-section" aria-label="客户统计"><div class="vehicle-metrics customer-list-metrics">${card('总客户数',rows.length,'当前数据权限范围','customers-total')}${card('正式客户',formal,'至少一个关联项目达到 90%签约落地','customers-formal')}${card('潜在客户',potential,'尚无关联项目达到 90%签约落地','customers-potential')}</div></section>`);
}
function enhanceCustomerListSearch() {
  if((location.hash||'').replace(/^#/,'')!=='/customers')return;
  const panel=$('.customer-list-panel'),toolbar=panel?.querySelector('.toolbar');
  if(!panel||!toolbar||toolbar.dataset.customerSearchBound)return;
  toolbar.dataset.customerSearchBound='true';
  const input=toolbar.querySelector('input'),selects=[...toolbar.querySelectorAll('select')],queryButton=toolbar.querySelector('.btn.primary'),resetButton=$('#customer-reset');
  input.id='customer-search';
  input.placeholder='搜索客户名称、联系人或业务负责人';
  input.setAttribute('aria-label','搜索客户名称、联系人或业务负责人');
  const applyFilters=()=>{
    const keyword=input.value.trim().toLowerCase(),industry=selects[0]?.value||'',region=selects[1]?.value||'';
    let matched=0,formal=0;
    panel.querySelector('.customer-filter-empty')?.remove();
    panel.querySelectorAll('tbody tr').forEach(row=>{
      const id=row.querySelector('.object-meta')?.textContent.trim(),customer=customers.find(item=>item.id===id);
      if(!customer)return;
      const owners=customer.businessOwners||demoCustomerBusinessOwners[customer.id]||[customer.owner];
      const searchable=[customer.name,customer.short,customer.id,customer.contact,customer.phone,...owners].filter(Boolean).join(' ').toLowerCase();
      const show=(!keyword||searchable.includes(keyword))&&(!industry||industry==='全部行业'||customer.industry===industry)&&(!region||region==='全部大区'||customer.region===region);
      row.hidden=!show;
      if(show){matched++;if(customer.customerType==='正式客户')formal++;}
    });
    if(!matched)panel.querySelector('tbody')?.insertAdjacentHTML('beforeend','<tr class="empty-row customer-filter-empty"><td colspan="10">没有符合当前条件的客户</td></tr>');
    const count=panel.querySelector('.pagination > span');
    if(count)count.textContent=`共 ${matched} 条`;
    const values=$$('.customer-list-metrics .metric-value');
    if(values.length===3){values[0].textContent=`${matched} 个`;values[1].textContent=`${formal} 个`;values[2].textContent=`${matched-formal} 个`;}
  };
  queryButton?.addEventListener('click',applyFilters);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();applyFilters();}});
  resetButton?.addEventListener('click',()=>requestAnimationFrame(applyFilters));
}
const demoCustomerBusinessOwners={
  'CUST-001':['林晨','周琪'],
  'CUST-004':['周琪','林晨'],
  'CUST-006':['林晨','周琪'],
  'CUST-009':['周琪','林晨']
};
function enhanceCustomerBusinessOwners() {
  const match=/^\/customers\/([^/]+)$/.exec((location.hash||'').replace(/^#/,''));
  const facts=$('.customer-object-header .facts');
  if(!match||!facts)return;
  const customer=customers.find(item=>item.id===match[1]);
  if(!customer)return;
  const factByLabel=label=>[...facts.children].find(item=>item.querySelector('.fact-label')?.textContent.replace('：','').trim()===label);
  factByLabel('主联系人')?.remove();
  const ownerFact=factByLabel('客户负责人')||factByLabel('业务负责人');
  if(!ownerFact||ownerFact.dataset.businessOwnersEnhanced)return;
  ownerFact.dataset.businessOwnersEnhanced='true';
  ownerFact.querySelector('.fact-label').textContent='业务负责人';
  const owners=customer.businessOwners||demoCustomerBusinessOwners[customer.id]||[customer.owner];
  customer.businessOwners=owners;
  const value=ownerFact.querySelector('.fact-value');
  value.classList.add('project-team-values','customer-business-owner-values');
  value.innerHTML=owners.map((name,index)=>`<span>${index?'、':''}${personInfoMarkup(name)}${index===0?'<span class="primary-person-tag" tabindex="0" aria-label="主要业务负责人">主<span class="primary-person-tooltip" role="tooltip">主要业务负责人</span></span>':''}</span>`).join('');
}
const demoCustomerAddresses={
  'CUST-001':'上海临港',
  'CUST-002':'广州南沙',
  'CUST-003':'唐山迁安',
  'CUST-004':'上海浦东',
  'CUST-005':'成都青白江',
  'CUST-006':'上海松江',
  'CUST-007':'上海外高桥',
  'CUST-008':'上海嘉定',
  'CUST-009':'上海洋山港'
};
const demoCustomerBusinessInfo={
  'CUST-001':{registeredAt:'2018-06-12',legalPerson:'陈海涛',shareholders:'示例控股主体A（65%）、张启明（35%）',businessPhone:'000-0000-0101'},
  'CUST-004':{registeredAt:'2020-03-18',legalPerson:'示例自然人A',shareholders:'示例自然人A（70%）、示例投资主体B（30%）',businessPhone:'000-0000-0102'},
  'CUST-006':{registeredAt:'2026-08-20',legalPerson:'示例自然人B',shareholders:'示例自然人B（60%）、示例投资主体C（40%）',businessPhone:'000-0000-0103'},
  'CUST-007':{registeredAt:'2019-11-06',legalPerson:'示例自然人C',shareholders:'示例控股主体D（80%）、示例自然人C（20%）',businessPhone:'000-0000-0104'},
  'CUST-008':{registeredAt:'2022-05-16',legalPerson:'示例自然人D',shareholders:'示例控股主体E（70%）、示例自然人D（30%）',businessPhone:'000-0000-0105',creditCode:'91310114MA1GX8****',enterpriseType:'有限责任公司（自然人投资或控股）',enterpriseStatus:'存续',registrationNumber:'31011400******',taxpayerId:'91310114MA1GX8****',organizationCode:'MA1GX8****',businessTerm:'2022-05-16 至 无固定期限',taxpayerQualification:'增值税一般纳税人',approvedAt:'2026-04-21',nationalIndustry:'道路货物运输',staffSize:'50-99人',insuredCount:'43人',englishName:'Demo New Energy Transportation Co., Ltd.',registrationAuthority:'示例登记机关',registeredAddress:'示例注册地址',mailingAddress:'示例注册地址'},
  'CUST-009':{registeredAt:'2016-09-28',legalPerson:'示例自然人E',shareholders:'示例控股主体H（90%）、示例自然人E（10%）',businessPhone:'000-0000-0106'}
};
const demoCustomerDueDiligence={
  'CUST-008':{
    queriedAt:'2026-09-15 11:30:00',
    source:'第三方企业数据服务',
    shareholders:[{name:'示例控股主体E',ratio:'70%'},{name:'示例自然人D',ratio:'30%'}],
    investments:[{name:'示例投资主体F',ratio:'51%',status:'存续'},{name:'示例投资主体G',ratio:'70%',status:'存续'}],
    riskCounts:{dishonest:0,restricted:0,litigation:2,penalty:1,abnormal:0},
    lawsuits:[{type:'合同纠纷',title:'运输服务合同履约争议',status:'审理中'},{type:'债务诉讼',title:'设备采购款争议',status:'已结案'}],
    penalties:[{title:'道路运输台账记录不完整',status:'已完成整改'}]
  }
};
function ensureCustomerBusinessRiskData(customer) {
  const business=demoCustomerBusinessInfo[customer.id]||{};
  Object.entries(business).forEach(([key,value])=>{if(!customer[key])customer[key]=value;});
  const demoSequence=customer.id.replace(/\D/g,'').padStart(3,'0');
  customer.creditCode??=`DEMO-CREDIT-${demoSequence}`;
  customer.enterpriseType??='有限责任公司';
  customer.legalPerson??=`示例自然人${demoSequence}`;
  customer.registeredAt??='2020-01-01';
  customer.enterpriseStatus??='存续';
  customer.registrationNumber??=`DEMO-REG-${demoSequence}`;
  customer.taxpayerId??=`DEMO-TAX-${demoSequence}`;
  customer.organizationCode??=`DEMO-ORG-${demoSequence}`;
  customer.businessTerm??='长期';
  customer.taxpayerQualification??='增值税一般纳税人';
  customer.approvedAt??='2026-09-01';
  customer.nationalIndustry??=customer.industry||'道路货物运输';
  customer.staffSize??='50-99人';
  customer.insuredCount??='48人';
  customer.englishName??=`Demo Logistics ${demoSequence} Co., Ltd.`;
  customer.registrationAuthority??='示例市场监督管理局';
  customer.registeredAddress??=customer.address||'';
  customer.mailingAddress??=customer.address||'';
  customer.businessPhone??=`000-0100-${demoSequence}`;
  customer.shareholders??=`示例控股主体${demoSequence}（100%）`;
  customer.ownRisk??=customer.risk||'暂无自身风险信息';
  customer.surroundingRisk??='未发现关联企业重大风险';
  customer.historicalRisk??='无历史高风险记录';
  customer.riskWarning??='暂无预警提醒';
  customer.legalLitigation??='未发现未结重大法律诉讼';
  customer.operatingRisk??=(customer.id==='CUST-008'?'合同已签署，需关注车辆交付进度':'暂无重大经营风险');
}
function customerBusinessRiskMarkup(customer) {
  const due=demoCustomerDueDiligence[customer.id]||{queriedAt:customer.updated||'',source:'人工录入',shareholders:[],investments:[],riskCounts:{dishonest:0,restricted:0,litigation:0,penalty:0,abnormal:0},lawsuits:[],penalties:[]};
  const businessUpdatedAt=customer.businessInfoUpdatedAt||due.queriedAt||customer.updated||'未更新';
  const coreFields=[['统一社会信用代码',customer.creditCode],['企业类型',customer.enterpriseType],['法定代表人',customer.legalPerson],['注册资本',customer.capital],['成立日期',customer.registeredAt],['企业状态',customer.enterpriseStatus],['经营范围',customer.scope,'wide']];
  const moreFields=[['工商注册号',customer.registrationNumber],['纳税人识别号',customer.taxpayerId],['组织机构代码',customer.organizationCode],['营业期限',customer.businessTerm],['纳税人资质',customer.taxpayerQualification],['核准日期',customer.approvedAt],['国标行业',customer.nationalIndustry],['人员规模',customer.staffSize],['参保人数',customer.insuredCount],['英文名称',customer.englishName],['登记机关',customer.registrationAuthority],['注册地址',customer.registeredAddress],['通信地址',customer.mailingAddress],['联系电话',customer.businessPhone],['股东',customer.shareholders],['实际控制人',customer.controller]];
  const riskCards=[['失信被执行人',due.riskCounts.dishonest?due.riskCounts.dishonest+' 项':'否'],['限制高消费',due.riskCounts.restricted?due.riskCounts.restricted+' 项':'否'],['司法诉讼',due.riskCounts.litigation+' 项'],['行政处罚',due.riskCounts.penalty+' 项'],['经营异常',due.riskCounts.abnormal?due.riskCounts.abnormal+' 项':'未列入经营异常名录']];
  return `<div class="section-title customer-business-title"><div><h2>企业尽调信息</h2><p>按“外部事实、内部判断”分层展示，避免混用</p></div></div>
    <section class="customer-due-section"><div class="customer-due-section-head"><div><h3>工商基本信息</h3><p>可由外部查询带入，人工只做纠错与确认</p></div><div class="customer-business-refresh"><span>更新时间：${esc(businessUpdatedAt)}</span><button type="button" class="btn ghost small" data-customer-business-refresh>刷新</button></div></div><div class="customer-business-core-grid">${coreFields.map(([label,value,width])=>`<article class="customer-business-card ${width||''}"><span>${label}</span><strong>${esc(value||'未提供')}</strong></article>`).join('')}</div><details class="customer-business-more"><summary>更多工商信息</summary><dl class="desc-list customer-business-desc">${moreFields.map(([label,value])=>`<dt>${label}</dt><dd>${esc(value||'未提供')}</dd>`).join('')}</dl></details></section>
    <section class="customer-due-section"><div class="customer-due-section-head"><div><h3>股权与控制人信息</h3><p>签约前或涉及授信时按需查询</p></div></div><div class="customer-equity-grid"><article class="customer-equity-card"><h4>股东列表</h4>${(due.shareholders.length?due.shareholders:[{name:customer.shareholders||'未提供',ratio:'—'}]).map(item=>`<div class="customer-equity-row"><span>${esc(item.name)}</span><strong>${esc(item.ratio)}</strong></div>`).join('')}</article><article class="customer-equity-card"><h4>实际控制人</h4><div class="customer-controller"><strong>${esc(customer.controller||'未确认')}</strong><small>原型展示结果，需人工确认</small></div></article><article class="customer-equity-card"><h4>对外投资企业</h4>${due.investments.length?due.investments.map(item=>`<div class="customer-equity-row"><span>${esc(item.name)}<small>${esc(item.status)}</small></span><strong>${esc(item.ratio)}</strong></div>`).join(''):'<div class="help">暂无查询结果</div>'}</article></div></section>
    <section class="customer-due-section"><div class="customer-due-section-head"><div><h3>风险信息</h3><p>只展示查询到的公开事实，不自动等同于“高风险”</p></div></div><div class="customer-risk-summary">${riskCards.map(([label,value],index)=>`<article class="customer-risk-stat ${index>1&&value!=='0 项'?'has-record':''}"><span>${label}</span><strong>${value}</strong></article>`).join('')}</div><div class="customer-risk-events"><article><h4>司法诉讼</h4>${due.lawsuits.length?due.lawsuits.map(item=>`<div class="customer-risk-event"><span class="tag warning">${esc(item.type)}</span><strong>${esc(item.title)}</strong><em>${esc(item.status)}</em></div>`).join(''):'<div class="help">未查询到记录</div>'}</article><article><h4>行政处罚</h4>${due.penalties.length?due.penalties.map(item=>`<div class="customer-risk-event"><strong>${esc(item.title)}</strong><em>${esc(item.status)}</em></div>`).join(''):'<div class="help">未查询到记录</div>'}</article></div></section>`;
}
function customerBusinessQueryResult(customer,name) {
  const demo=demoCustomerBusinessInfo[customer.id]||{},due=demoCustomerDueDiligence[customer.id]||{};
  const value=(key,fallback='')=>customer[key]||demo[key]||fallback;
  return {
    name,
    creditCode:value('creditCode','91310000MA7XXXXXXX'),
    enterpriseType:value('enterpriseType','有限责任公司'),
    legalPerson:value('legalPerson','待核实'),
    capital:value('capital','未提供'),
    registeredAt:value('registeredAt',''),
    enterpriseStatus:value('enterpriseStatus','存续'),
    scope:value('scope','未查询到经营范围'),
    registrationNumber:value('registrationNumber'),
    taxpayerId:value('taxpayerId'),
    organizationCode:value('organizationCode'),
    businessTerm:value('businessTerm'),
    taxpayerQualification:value('taxpayerQualification'),
    approvedAt:value('approvedAt'),
    nationalIndustry:value('nationalIndustry'),
    staffSize:value('staffSize'),
    insuredCount:value('insuredCount'),
    englishName:value('englishName'),
    registrationAuthority:value('registrationAuthority'),
    businessPhone:value('businessPhone'),
    registeredAddress:value('registeredAddress',customer.address||''),
    mailingAddress:value('mailingAddress',customer.address||''),
    shareholders:value('shareholders'),
    controller:value('controller'),
    riskCounts:due.riskCounts||{dishonest:0,restricted:0,litigation:0,penalty:0,abnormal:0},
    lawsuits:due.lawsuits||[],
    penalties:due.penalties||[],
    queriedAt:nowText()
  };
}
function customerQueryRiskMarkup(result) {
  const counts=result?.riskCounts||{},items=[['失信被执行人',counts.dishonest?counts.dishonest+' 项':'否'],['限制高消费',counts.restricted?counts.restricted+' 项':'否'],['司法诉讼',(counts.litigation||0)+' 项'],['行政处罚',(counts.penalty||0)+' 项'],['经营异常',counts.abnormal?counts.abnormal+' 项':'未列入']];
  return `<div class="customer-query-risk-meta">查询时间：${esc(result.queriedAt||'未查询')}</div><div class="customer-query-risk-grid">${items.map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join('')}</div>`;
}
function fillCustomerBusinessQueryResult(form,result) {
  const fields={
    'customer-credit-code':'creditCode','customer-enterprise-type':'enterpriseType','customer-legal-person':'legalPerson','customer-capital':'capital','customer-registered-at':'registeredAt','customer-enterprise-status':'enterpriseStatus','customer-scope':'scope','customer-registration-number':'registrationNumber','customer-taxpayer-id':'taxpayerId','customer-organization-code':'organizationCode','customer-business-term':'businessTerm','customer-taxpayer-qualification':'taxpayerQualification','customer-approved-at':'approvedAt','customer-national-industry':'nationalIndustry','customer-staff-size':'staffSize','customer-insured-count':'insuredCount','customer-english-name':'englishName','customer-registration-authority':'registrationAuthority','customer-business-phone':'businessPhone','customer-registered-address':'registeredAddress','customer-mailing-address':'mailingAddress','customer-shareholders':'shareholders','customer-controller':'controller'
  };
  Object.entries(fields).forEach(([id,key])=>{const control=form.querySelector('#'+id);if(control)control.value=result[key]||'';});
  form.businessQueryResult=result;
  const riskBlock=form.querySelector('#customer-query-risk-result');
  if(riskBlock){riskBlock.hidden=false;riskBlock.innerHTML=customerQueryRiskMarkup(result);}
  toast('工商与风险信息已带入，保存客户后生效');
}
function openCustomerBusinessQuery(form,customer) {
  const name=form.querySelector('#customer-name')?.value.trim();
  if(!name){toast('请先输入客户名称','error');form.querySelector('#customer-name')?.focus();return;}
  const result=customerBusinessQueryResult(customer,name),counts=result.riskCounts;
  const core=[['企业名称',result.name],['统一社会信用代码',result.creditCode],['企业类型',result.enterpriseType],['法定代表人',result.legalPerson],['注册资本',result.capital],['成立日期',result.registeredAt||'未提供'],['企业状态',result.enterpriseStatus],['经营范围',result.scope]];
  modal('工商与风险信息查询',`<div class="customer-query-result"><div class="customer-query-result-head"><span class="tag success">查询完成</span><span>${esc(result.queriedAt)}</span></div><h3>工商基本信息</h3><div class="customer-query-preview-grid">${core.map(([label,value],index)=>`<article class="${index===7?'wide':''}"><span>${label}</span><strong>${esc(value||'未提供')}</strong></article>`).join('')}</div><h3>风险信息</h3><div class="customer-query-risk-grid">${[['失信被执行人',counts.dishonest?counts.dishonest+' 项':'否'],['限制高消费',counts.restricted?counts.restricted+' 项':'否'],['司法诉讼',(counts.litigation||0)+' 项'],['行政处罚',(counts.penalty||0)+' 项'],['经营异常',counts.abnormal?counts.abnormal+' 项':'未列入']].map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join('')}</div></div>`,'一键带入',()=>fillCustomerBusinessQueryResult(form,result));
  document.querySelector('.modal-backdrop:last-of-type .modal')?.classList.add('customer-business-query-modal');
}
function enhanceCustomerBusinessQuery(form,customer) {
  const input=form.querySelector('#customer-name'),field=input?.closest('.field');
  if(!input||!field||field.dataset.businessQuery)return;
  field.dataset.businessQuery='true';field.classList.add('customer-name-query-field');
  const row=document.createElement('div');row.className='customer-name-query-row';
  input.before(row);row.append(input);row.insertAdjacentHTML('beforeend','<button type="button" class="btn customer-business-query-button" id="customer-business-query">工商信息查询</button>');
  row.querySelector('#customer-business-query').addEventListener('click',()=>openCustomerBusinessQuery(form,customer));
}
function enhanceCustomerBusinessOwnersForm(form,customer) {
  const ownerField=fieldByLabel(form,'客户负责人'),regionField=fieldByLabel(form,'所属大区'),industryField=fieldByLabel(form,'所属行业');
  if(!ownerField||!regionField||!industryField||ownerField.dataset.multiOwner)return;
  ownerField.dataset.multiOwner='true';
  const grid=ownerField.parentElement;
  grid.insertBefore(regionField,ownerField);
  const original=ownerField.querySelector('select'),selected=[...new Set(customer.businessOwners||demoCustomerBusinessOwners[customer.id]||[customer.owner||original?.value].filter(Boolean))];
  let primary=selected.includes(customer.owner)?customer.owner:(selected[0]||'');
  original?.remove();
  ownerField.insertAdjacentHTML('beforeend',`<input type="hidden" id="customer-business-owners" value="${esc(selected.join('、'))}"><input type="hidden" id="customer-primary-owner" value="${esc(primary)}"><details class="project-member-picker customer-owner-picker"><summary aria-label="选择客户负责人（支持多选）"><span></span><span aria-hidden="true">⌄</span></summary><div class="project-member-options customer-owner-options" role="group" aria-label="客户负责人选项">${users.filter(person=>person.role==='销售人员').map(person=>`<div class="customer-owner-option"><label><input type="checkbox" value="${esc(person.name)}" ${selected.includes(person.name)?'checked':''}><span>${esc(person.name)}<small>${esc(person.role)} · ${esc(person.region)}</small></span></label><button type="button" class="customer-owner-primary-action" data-customer-owner-primary="${esc(person.name)}" hidden>设为主要</button></div>`).join('')}</div></details>`);
  const hidden=ownerField.querySelector('#customer-business-owners'),hiddenPrimary=ownerField.querySelector('#customer-primary-owner'),picker=ownerField.querySelector('.customer-owner-picker'),summary=picker.querySelector('summary > span');
  const refresh=()=>{
    const names=[...picker.querySelectorAll('input:checked')].map(input=>input.value);
    if(!names.includes(primary))primary=names[0]||'';
    hidden.value=names.join('、');
    hiddenPrimary.value=primary;
    summary.innerHTML=names.length?names.map(name=>`${esc(name)}${name===primary?'<em>主要</em>':''}`).join('<b>、</b>'):'请选择负责人';
    picker.querySelectorAll('.customer-owner-option').forEach(row=>{
      const checkbox=row.querySelector('input'),action=row.querySelector('.customer-owner-primary-action');
      action.hidden=!checkbox.checked;
      action.disabled=checkbox.value===primary;
      action.textContent=checkbox.value===primary?'主要':'设为主要';
      action.classList.toggle('is-primary',checkbox.value===primary);
    });
  };
  picker.querySelectorAll('input').forEach(checkbox=>checkbox.addEventListener('change',refresh));
  picker.querySelectorAll('[data-customer-owner-primary]').forEach(action=>action.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();primary=action.dataset.customerOwnerPrimary;refresh();}));
  picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});
  refresh();
}
function enhanceCustomerBusinessAndRisk() {
  const route=(location.hash||'').replace(/^#/,'');
  const detailMatch=/^\/customers\/([^/]+)$/.exec(route);
  if(detailMatch) {
    const customer=customers.find(item=>item.id===detailMatch[1]),section=$('#customer-panel-overview .detail-grid > section');
    if(customer&&section&&!section.dataset.businessRiskEnhanced) {
      ensureCustomerBusinessRiskData(customer);
      section.dataset.businessRiskEnhanced='true';
      section.innerHTML=customerBusinessRiskMarkup(customer);
      $('[data-customer-business-refresh]',section)?.addEventListener('click',()=>{
        customer.businessInfoUpdatedAt=nowText();
        render();
        toast('工商信息已刷新');
      });
    }
  }
  const formMatch=/^\/customers\/(new|[^/]+\/edit)$/.exec(route),form=$('#customer-form');
  if(!formMatch||!form)return;
  const customer=formMatch[1]==='new'?{}:customers.find(item=>item.id===formMatch[1].replace('/edit',''))||{};
  ensureCustomerBusinessRiskData(customer);
  const section=[...form.querySelectorAll('.form-section')].find(item=>item.querySelector('.section-title h2')?.textContent.trim()==='核心工商与风险'||item.dataset.businessRiskForm);
  if(!section||section.dataset.businessRiskForm)return;
  section.dataset.businessRiskForm='true';
  section.querySelector('.section-title h2').textContent='工商与风险信息';
  const businessPhone=customer.businessPhone||demoCustomerBusinessInfo[formMatch[1].replace('/edit','')]?.businessPhone||'';
  const inputField=(id,label,value,type='text',span='')=>`<div class="field ${span}"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(value||'')}"></div>`;
  const textareaField=(id,label,value,span='')=>`<div class="field ${span}"><label for="${id}">${label}</label><textarea class="textarea" id="${id}">${esc(value||'')}</textarea></div>`;
  const coreFields=[['customer-credit-code','统一社会信用代码',customer.creditCode],['customer-enterprise-type','企业类型',customer.enterpriseType],['customer-legal-person','法定代表人',customer.legalPerson],['customer-capital','注册资本',customer.capital],['customer-registered-at','成立日期',customer.registeredAt,'date'],['customer-enterprise-status','企业状态',customer.enterpriseStatus]];
  const moreFields=[['customer-registration-number','工商注册号',customer.registrationNumber],['customer-taxpayer-id','纳税人识别号',customer.taxpayerId],['customer-organization-code','组织机构代码',customer.organizationCode],['customer-business-term','营业期限',customer.businessTerm],['customer-taxpayer-qualification','纳税人资质',customer.taxpayerQualification],['customer-approved-at','核准日期',customer.approvedAt,'date'],['customer-national-industry','国标行业',customer.nationalIndustry],['customer-staff-size','人员规模',customer.staffSize],['customer-insured-count','参保人数',customer.insuredCount],['customer-english-name','英文名称',customer.englishName],['customer-registration-authority','登记机关',customer.registrationAuthority],['customer-business-phone','联系电话',businessPhone]];
  section.querySelector('.form-grid').innerHTML=`<div class="form-subsection-title">外部查询字段（可人工修正）</div>${coreFields.map(args=>inputField(...args)).join('')}${textareaField('customer-scope','经营范围',customer.scope,'span-3')}<div class="form-subsection-title">更多工商与股权信息</div>${moreFields.map(args=>inputField(...args)).join('')}${textareaField('customer-registered-address','注册地址',customer.registeredAddress,'span-3')}${textareaField('customer-mailing-address','通信地址',customer.mailingAddress,'span-3')}${textareaField('customer-shareholders','股东',customer.shareholders,'span-2')}${inputField('customer-controller','实际控制人',customer.controller)}<div class="form-subsection-title">风险查询结果</div><div class="customer-query-risk-result" id="customer-query-risk-result" ${customer.externalRiskSnapshot?'':'hidden'}>${customer.externalRiskSnapshot?customerQueryRiskMarkup(customer.externalRiskSnapshot):''}</div>`;
  const basicCapitalField=[...form.querySelectorAll('.form-section:first-of-type .field')].find(field=>field.querySelector('label')?.textContent.trim()==='注册资本');
  basicCapitalField?.remove();
  const businessPhoneInput=section.querySelector('#customer-business-phone');
  if(businessPhoneInput&&!businessPhoneInput.value)businessPhoneInput.value=businessPhone;
  enhanceCustomerBusinessQuery(form,customer);
  enhanceCustomerBusinessOwnersForm(form,customer);
}
function enhanceCustomerAddressAndForm() {
  customers.forEach(customer=>{if(!customer.address)customer.address=demoCustomerAddresses[customer.id]||'';});
  if(typeof ensureCustomerAddress==='function')ensureCustomerAddress();
  const route=(location.hash||'').replace(/^#/,'');
  const formMatch=/^\/customers\/(new|[^/]+\/edit)$/.exec(route),form=$('#customer-form');
  if(!formMatch||!form)return;
  const customer=formMatch[1]==='new'?{}:customers.find(item=>item.id===formMatch[1].replace('/edit',''))||{};
  const grid=form.querySelector('.form-section .form-grid');
  if(grid&&!form.querySelector('#customer-address'))grid.insertAdjacentHTML('beforeend',`<div class="field span-3 customer-address-field"><label for="customer-address">客户地址</label><input class="input" id="customer-address" value="${esc(customer.address||'')}" placeholder="请输入客户的办公或经营地址"></div>`);
  form.querySelectorAll('.form-section').forEach(section=>{
    if(section.querySelector('.section-title h2')?.textContent.trim()==='客户资料')section.remove();
  });
}
function enhanceCustomerBrief() {
  const route=(location.hash||'').replace(/^#/,'');
  const detailMatch=/^\/customers\/([^/]+)$/.exec(route);
  if(detailMatch) {
    const customer=customers.find(item=>item.id===detailMatch[1]),facts=$('.customer-object-header .facts');
    if(customer&&facts&&!facts.querySelector('.customer-brief-fact')) {
      facts.insertAdjacentHTML('beforeend',`<div class="customer-brief-fact"><div class="fact-label">客户简介</div><div class="fact-value customer-brief-value"><div class="customer-brief-copy is-collapsed">${esc(customer.brief||'暂无客户简介')}</div><button type="button" class="customer-brief-toggle" aria-expanded="false" hidden>展开</button></div></div>`);
      requestAnimationFrame(()=>{
        const copy=facts.querySelector('.customer-brief-copy'),toggle=facts.querySelector('.customer-brief-toggle');
        if(!copy||!toggle)return;
        const lineHeight=parseFloat(getComputedStyle(copy).lineHeight)||20;
        toggle.hidden=copy.scrollHeight<=lineHeight*4+1;
        toggle.onclick=()=>{
          const expanded=toggle.getAttribute('aria-expanded')==='true';
          copy.classList.toggle('is-collapsed',expanded);
          toggle.setAttribute('aria-expanded',String(!expanded));
          toggle.textContent=expanded?'展开':'收起';
        };
      });
    }
  }
  const formMatch=/^\/customers\/(new|[^/]+\/edit)$/.exec(route),form=$('#customer-form');
  if(!formMatch||!form||form.querySelector('#customer-brief'))return;
  const customer=formMatch[1]==='new'?{}:customers.find(item=>item.id===formMatch[1].replace('/edit',''))||{};
  const grid=form.querySelector('.form-section .form-grid');
  grid?.insertAdjacentHTML('beforeend',`<div class="field span-3 customer-brief-field"><label for="customer-brief">客户简介</label><textarea class="textarea" id="customer-brief" placeholder="请简要描述客户业务、经营区域及合作背景">${esc(customer.brief||'')}</textarea></div>`);
}
function customerRelatedProjects(customer) {
  return permittedProjects().filter(project=>project.customer===customer.short||project.customer===customer.name);
}
function customerProjectMetricsMarkup(customer) {
  const rows=customerRelatedProjects(customer);
  const total=key=>rows.reduce((sum,project)=>sum+(Number.isFinite(project[key])?project[key]:0),0);
  const deliveredMetric=(label,kind,icon)=>{
    const value=rows.reduce((sum,project)=>sum+projectLinkedVehicleRows(project.id,kind).length,0);
    const note=rows.length?'由车辆管理中的项目关联自动汇总':'暂无关联项目';
    return `<article class="metric-card"><div class="metric-main"><div class="metric-label">${label}</div><div class="metric-value">${value}<span class="metric-unit">辆</span></div></div><div class="metric-icon delivered" aria-hidden="true">${icon}</div><div class="metric-note">${note}</div></article>`;
  };
  const plannedMetric=(label,key,icon)=>`<article class="metric-card"><div class="metric-main"><div class="metric-label">${label}</div><div class="metric-value">${total(key)}<span class="metric-unit">辆</span></div></div><div class="metric-icon planned" aria-hidden="true">${icon}</div><div class="metric-note">关联项目计划需求合计</div></article>`;
  return `<section class="panel customer-project-metrics-module" aria-labelledby="customer-project-metrics-title"><div class="customer-project-metrics-heading"><h2 id="customer-project-metrics-title">关联项目统计</h2><p>汇总当前用户有权查看的该客户关联项目</p></div><div class="customer-project-metrics"><article class="metric-card"><div class="metric-main"><div class="metric-label">关联项目</div><div class="metric-value">${rows.length}<span class="metric-unit">个</span></div></div><div class="metric-icon projects" aria-hidden="true">${projectMetricIconMarkup}</div><div class="metric-note">当前数据权限范围</div></article>${plannedMetric('计划车辆','tractor',vehicleSourceIcon)}${deliveredMetric('已交付车辆','tractor',vehicleSourceIcon)}${plannedMetric('计划挂车','trailer',icons.trailer)}${deliveredMetric('已交付挂车','trailer',icons.trailer)}</div></section>`;
}
function enhanceCustomerProjectSummary() {
  const match=/^\/customers\/([^/]+)$/.exec((location.hash||'').replace(/^#/,''));
  const panel=$('#customer-panel-overview');
  if(!match||!panel||panel.dataset.projectSummary)return;
  const customer=customers.find(item=>item.id===match[1]);
  if(!customer)return;
  if(!customerRelatedProjects(customer).length){panel.dataset.projectSummary='empty';return;}
  const header=$('.customer-object-header');
  if(header&&!$('.customer-project-metrics-module'))header.insertAdjacentHTML('afterend',customerProjectMetricsMarkup(customer));
  panel.dataset.projectSummary='true';
}
function enhanceCustomerDocuments() {
  configureCustomerDetailTabs();
  enhanceCustomerTypes();
  enhanceCustomerListMetrics();
  enhanceCustomerListSearch();
  enhanceCustomerBusinessOwners();
  enhanceCustomerBusinessAndRisk();
  enhanceCustomerAddressAndForm();
  enhanceCustomerBrief();
  enhanceCustomerProjectSummary();
  const route=(location.hash||'').replace(/^#/,'');
  const match=/^\/customers\/([^/]+)$/.exec(route);
  const panel=$('#customer-panel-files');
  if(!match||!panel||panel.dataset.documentCards)return;
  const customer=customers.find(item=>item.id===match[1]);
  if(customer)renderCustomerDocumentsPanel(customer);
}
window.addEventListener('DOMContentLoaded',()=>{
  configureCustomerDetailTabs();
  enhanceCustomerTypes();
  enhanceCustomerListMetrics();
  enhanceCustomerListSearch();
  enhanceCustomerBusinessOwners();
  enhanceCustomerBusinessAndRisk();
  enhanceCustomerAddressAndForm();
  enhanceCustomerBrief();
  enhanceCustomerDocuments();
  new MutationObserver(enhanceCustomerDocuments).observe(document.body,{childList:true,subtree:true});
});
function bindDemoStateTool() {
  const tool=$('#demo-state-tool'),handle=$('#demo-drag-handle');
  if(!tool||!handle)return;
  const move=(x,y)=>{
    const rect=tool.getBoundingClientRect();
    demoToolPosition={x:Math.max(8,Math.min(x,window.innerWidth-rect.width-8)),y:Math.max(8,Math.min(y,window.innerHeight-rect.height-8))};
    tool.style.left=demoToolPosition.x+'px';tool.style.top=demoToolPosition.y+'px';tool.style.right='auto';tool.style.bottom='auto';
  };
  if(demoToolPosition)move(demoToolPosition.x,demoToolPosition.y);
  let drag=null;
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const rect=tool.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-rect.left,y:e.clientY-rect.top};
    handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId)move(e.clientX-drag.x,e.clientY-drag.y);});
  const end=()=>{drag=null;handle.classList.remove('dragging');};
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
  handle.addEventListener('keydown',e=>{
    const deltas={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]},delta=deltas[e.key];
    if(!delta)return;e.preventDefault();const rect=tool.getBoundingClientRect();move(rect.left+delta[0],rect.top+delta[1]);
  });
}
let rankingKind='tractor';
const projectStageColors=['#4c96ff','#40cfa0','#ad99f5','#ffdb62','#ffa36b','#c9c9cb'];
function stageMarkup(stage) {
  const color=projectStageColors[stages.indexOf(stage)]||'#c9c9cb';
  return '<span class="stage-text" style="--stage-color:'+color+'">'+esc(stage)+'</span>';
}
function rankedVehicleProjects(rows,kind=rankingKind) {
  return [...rows].sort((a,b)=>(b[kind]||0)-(a[kind]||0)||a.id.localeCompare(b.id)).slice(0,5);
}
function deliveryText(value,compact=false) { return Number.isInteger(value)?value+(compact?' <span class="metric-unit">辆</span>':' 辆'):'未录入'; }
function syncModelDeliveries(p,rows) {
  for(const [kind,key] of [['牵引车','deliveredTractor'],['挂车','deliveredTrailer']]) {
    const typed=rows.filter(v=>kind==='挂车'?v.kind==='挂车':v.kind!=='挂车'),known=typed.filter(v=>Number.isInteger(v.deliveredQty));
    if(p.modelDeliveryTracking) {
      p[key]=known.length?known.reduce((n,v)=>n+v.deliveredQty,0):typed.length?undefined:0;
      p[key+'Partial']=known.length<typed.length;
    }
  }
}
function vehicleTypeMarkup(kind) {
  const typeIcons={
    '牵引车':tractorTypeIcon,
    '挂车':icons.trailer,
    '矿卡':'<img src="./assets/mining-truck.svg" alt="" width="20" height="20">',
    '自卸车':'<img src="./assets/dump-truck.svg" alt="" width="20" height="20">'
  };
  return `<span class="vehicle-type-cell"><span class="vehicle-type-icon" aria-hidden="true">${typeIcons[kind]||icons.truck}</span><span>${esc(kind)}</span></span>`;
}
function projectDeliveredText(project,key) {
  const kind=key==='deliveredTrailer'?'trailer':'tractor';
  return projectLinkedVehicleRows(project.id,kind).length;
}
function customerProjectLinks(customer) {
  const related=permittedProjects().filter(project=>project.customer===customer.short);
  if(!related.length)return '0';
  const popupId='customer-projects-'+customer.id;
  return `<span class="customer-project-links"><button type="button" class="customer-project-count" aria-label="查看 ${related.length} 个关联项目" aria-controls="${esc(popupId)}" aria-expanded="false">${related.length}</button><span class="customer-project-popup" id="${esc(popupId)}" popover="manual"><strong>关联项目（${related.length}）</strong>${related.map(project=>`<a href="#/projects/${encodeURIComponent(project.id)}">${esc(project.name)}<small>${esc(project.id)}</small></a>`).join('')}</span></span>`;
}
function bindCustomerProjectLinks() {
  document.querySelectorAll('.customer-project-links').forEach(container=>{
    const button=container.querySelector('button'),popup=container.querySelector('.customer-project-popup');
    const close=()=>{popup.hidePopover();button.setAttribute('aria-expanded','false');};
    const open=()=>{
      popup.showPopover();button.setAttribute('aria-expanded','true');
      const rect=button.getBoundingClientRect(),width=popup.getBoundingClientRect().width;
      popup.style.left=Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12))+'px';
      const height=popup.getBoundingClientRect().height;
      popup.style.top=(rect.bottom+height<window.innerHeight?rect.bottom:Math.max(12,rect.top-height))+'px';
    };
    container.onmouseenter=open;
    container.onmouseleave=event=>{if(!container.contains(event.relatedTarget)&&!container.contains(document.activeElement))close();};
    container.onfocusin=open;
    container.onfocusout=event=>{if(!container.contains(event.relatedTarget))close();};
    button.onclick=open;
    container.onkeydown=event=>{if(event.key==='Escape'){button.focus();close();}else if(event.key==='ArrowDown'&&event.target===button){event.preventDefault();open();popup.querySelector('a').focus();}};
  });
}
function projectLinkedVehicleRows(projectId,kind) {
  return (vehiclePlanConfigs?.[kind]?.rows||[]).filter(row=>row.linkedProjectId===projectId);
}
function projectLinkedVehicleCounts(projectId) {
  return {tractor:projectLinkedVehicleRows(projectId,'tractor').length,trailer:projectLinkedVehicleRows(projectId,'trailer').length};
}
function projectVehicleRowDeliveredCount(projectId,row,rows) {
  const kind=row.kind==='挂车'?'trailer':'tractor',linkedRows=projectLinkedVehicleRows(projectId,kind),modelIndex=kind==='trailer'?4:3;
  const exactCount=linkedRows.filter(vehicle=>String(vehicle.cells[modelIndex]||'').trim()===String(row.model||'').trim()).length;
  const sameKindRows=rows.filter(item=>(item.kind==='挂车'?'trailer':'tractor')===kind);
  if(exactCount)return exactCount;
  return sameKindRows.length===1?linkedRows.length:null;
}
function planDeliveryTable(p) {
  const rows=vehicleRows[p.id]||[];
  return `<section class="panel detail-panel"><div class="section-title"><div><h2>需求与交付</h2><p>已交付数量由车辆管理中的项目关联自动汇总</p></div>${canEdit()?`<button class="btn" data-edit-demand="${p.id}">编辑需求</button>`:''}</div><div class="table-wrap"><table><thead><tr><th>类型</th><th>品牌</th><th>车型</th><th>电池容量</th><th>轴数</th><th class="num">需求数量</th><th class="num">已交付数量</th><th>备注</th></tr></thead><tbody>${rows.length?rows.map(v=>{const kind=v.kind==='挂车'?'trailer':'tractor',delivered=projectVehicleRowDeliveredCount(p.id,v,rows)??0,deliveredMarkup=delivered>0?`<button type="button" class="delivery-count-link" data-go="/vehicles/${kind==='tractor'?'tractors':'trailers'}?project=${encodeURIComponent(p.id)}" title="查看关联车辆" aria-label="查看${esc(v.kind)}关联车辆，当前已交付数量 ${delivered}">${delivered}</button>`:'<span class="delivery-count-zero">0</span>';return `<tr><td>${vehicleTypeMarkup(v.kind)}</td><td>${esc(v.brand)}</td><td>${esc(v.model)}</td><td>${esc(v.kind!=='挂车'?(v.battery||'—'):'—')}</td><td>${esc(v.kind==='挂车'&&v.axle&&v.axle!=='—'?v.axle+'轴':'—')}</td><td class="num">${v.qty}</td><td class="num">${deliveredMarkup}</td><td>${esc(v.note)}</td></tr>`;}).join(''):'<tr class="empty-row"><td colspan="8">车辆需求待完善，请先新增车型需求</td></tr>'}</tbody></table></div></section>`;
}
function projectVehicleStats(p) {
  const linked=projectLinkedVehicleCounts(p.id);
  const metrics=[
    ['需求车辆',p.tractor,'tractor',false],
    ['已交付车辆',linked.tractor,'tractor',true],
    ['需求挂车',p.trailer,'trailer',false],
    ['已交付挂车',linked.trailer,'trailer',true]
  ];
  return '<div class="project-vehicle-stats" role="group" aria-label="本项目车辆统计">'+metrics.map(([label,value,icon,delivered])=>
    '<div class="project-vehicle-metric"><div class="metric-icon '+(delivered?'delivered':'planned')+'" aria-hidden="true">'+(icon==='tractor'?vehicleSourceIcon:icons[icon])+'</div><div><div class="metric-label">'+label+'</div><div class="metric-value '+(!Number.isInteger(value)?'is-missing':'')+'">'+deliveryText(value,true)+'</div></div></div>'
  ).join('')+'</div>';
}
function enhancedStats(rows) {
  const counts=stages.map(s=>rows.filter(p=>p.stage===s).length);
  const reached=stages.map((_,i)=>rows.filter(p=>stages.indexOf(p.stage)>=i).length);
  const total=key=>rows.reduce((n,p)=>n+(p[key]||0),0);
  const linkedTotal=kind=>rows.reduce((sum,project)=>sum+projectLinkedVehicleRows(project.id,kind).length,0);
  const metric=(label,value,note='')=>{
    const delivered=label.startsWith('已交付'),project=label==='当前范围项目';
    const formatted=value.replace(/^(\d+)\s*(个|辆)$/, '$1<span class="metric-unit">$2</span>');
    return `<div class="metric-card"><div class="metric-main"><div class="metric-label">${label}</div><div class="metric-value ${value==='未录入'?'is-missing':''}">${formatted}</div></div><div class="metric-icon ${delivered?'delivered':project?'projects':'planned'}" aria-hidden="true">${project?projectMetricIconMarkup:label.includes('挂车')?icons.trailer:vehicleSourceIcon}</div><div class="metric-note">${note|| (project?'当前权限范围内的项目': '计划用车需求合计')}</div></div>`;
  };
  const bar=(label,value,max,note='',funnel=false)=>`<div class="chart-item"><div class="chart-label"><span>${esc(label)}</span><strong>${value}${note?' · '+note:''}</strong></div><div class="chart-track ${funnel?'funnel-track':''}"><div class="chart-fill" style="width:${max?value/max*100:0}%"></div></div></div>`;
  const rankings=rankedVehicleProjects(rows);
  const maxRank=Math.max(1,...rankings.map(p=>p.tractor+p.trailer));
  return `<section class="metric-section" aria-label="项目与车辆统计"><div class="vehicle-metrics">${metric('当前范围项目',rows.length+' 个')}${metric('需求车辆',total('tractor')+' 辆')}${metric('已交付车辆',linkedTotal('tractor')+' 辆','由车辆管理中的项目关联自动汇总')}${metric('需求挂车',total('trailer')+' 辆')}${metric('已交付挂车',linkedTotal('trailer')+' 辆','由车辆管理中的项目关联自动汇总')}</div></section><div class="charts-heading"><span>项目统计图表 · 当前权限范围</span><button class="btn" id="toggle-charts" aria-expanded="${chartsExpanded}" aria-controls="project-charts">${chartsExpanded?'收起统计图表':'展开统计图表'}</button></div><div id="project-charts" class="project-charts" ${chartsExpanded?'':'hidden'}><section class="panel chart-card"><h2>累计转化漏斗</h2><p class="help">按当前阶段推算累计到达，非历史转化追踪</p>${conversionFunnel(reached)}</section><section class="panel chart-card"><h2>当前阶段分布</h2><p class="help">各阶段当前项目数（个）</p>${stageDistribution(counts)}</section><section class="panel chart-card"><div class="ranking-title"><h2>计划用车数量排行</h2><div class="ranking-switch" role="group" aria-label="排行车辆类型">${[['tractor','车辆'],['trailer','挂车']].map(([key,label])=>`<button class="ranking-kind" data-ranking-kind="${key}" aria-pressed="${rankingKind===key}">${label}</button>`).join('')}</div></div><p class="help">前5个项目 · 计划${rankingKind==='tractor'?'车辆':'挂车'}数量（辆）</p><div class="vehicle-ranking"><div class="ranking-head"><span>序号</span><span>项目名称</span><span>计划数量</span></div>${rankings.length?rankings.map((p,i)=>`<div class="ranking-row"><span class="rank-number ${i<3?'top-rank':''}">${i+1}</span><div class="rank-project">${esc(p.name)}</div><strong>${p[rankingKind]||0}</strong></div>`).join(''):'<p class="help">暂无项目</p>'}</div></section></div>`;
}
function conversionFunnel(reached) {
  const colors=['#d9eaff','#b9d8ff','#92c2ff','#6aa9ff','#478dfa','#1dce7c'];
  const empty=reached.every(value=>value===0);
  const emptyWidths=[140,122,104,86,68,50,32];
  return '<div class="conversion-funnel'+(empty?' is-empty':'')+'"><div class="funnel-heading"><span>阶段 · 累计项目数</span><span>相邻转化率</span></div>'+stages.map((stage,i)=>{
    const top=empty?emptyWidths[i]:reached[i]/reached[0]*140;
    const bottom=empty?emptyWidths[i+1]:reached[Math.min(i+1,reached.length-1)]/reached[0]*140;
    const rate=i===0?(reached[0]?'100%':'—'):(reached[i-1]?Number((reached[i]/reached[i-1]*100).toFixed(1))+'%':'—');
    const polygon='<polygon points="'+(75-top/2)+',0 '+(75+top/2)+',0 '+(75+bottom/2)+',46 '+(75-bottom/2)+',46" fill="'+(empty?'var(--subtle)':colors[i])+'"/>';
    return '<div class="funnel-row"><svg class="funnel-segment" viewBox="0 0 150 46" preserveAspectRatio="none" aria-hidden="true">'+polygon+'</svg><div class="funnel-values"><span class="funnel-stage">'+esc(stage)+'</span><strong>'+reached[i]+' 个</strong><span class="funnel-rate">'+rate+'</span></div></div>';
  }).join('')+'</div>';
}
function stageDistribution(counts) {
  const total=counts.reduce((n,v)=>n+v,0);
  const colors=projectStageColors;
  const circumference=2*Math.PI*66;
  let offset=0;
  const segments=counts.map((count,i)=>{
    if(!count||!total)return '';
    const length=count/total*circumference;
    const segment='<circle cx="100" cy="100" r="66" fill="none" stroke="'+colors[i]+'" stroke-width="24" stroke-dasharray="'+Math.max(0,length-(count===total?0:3))+' '+circumference+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 100 100)"/>';
    offset+=length;return segment;
  }).join('');
  return '<div class="stage-distribution"><div class="stage-donut"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="66" fill="none" stroke="var(--subtle)" stroke-width="24"/>'+segments+'</svg><div class="donut-total"><strong>'+total+'</strong><span>项目总数</span></div></div><div class="stage-legend">'+stages.map((stage,i)=>'<button class="stage-legend-item" data-stage="'+stage+'" aria-pressed="'+(state.stage===stage)+'"><span class="legend-dot" style="background:'+colors[i]+'"></span><span>'+esc(stage)+'</span><strong>'+counts[i]+'</strong></button>').join('')+'</div></div>';
}
let projectDraft = null;
const projectChanges = {};
// 项目跟进记录独立关联项目，原型内保存，不与客户沟通记录共用。
const projectVisits = {};
function commitProjectVisit(id,values) {
  const p=permittedProjects().find(project=>project.id===id);
  if(!p||!canEdit())throw new Error('无权新增该项目的跟进记录');
  const visitors=[state.user.name];
  if(!values.visitedAt||!Number.isFinite(new Date(values.visitedAt).getTime()))throw new Error('请选择有效的拜访时间');
  if(!visitors.length||visitors.some(name=>!users.some(person=>person.name===name)))throw new Error('当前用户无效');
  if(!values.content?.trim())throw new Error('请填写沟通内容');
  const nextStage=values.stage||p.stage,reason=(values.stageReason||'').trim(),stageError=validateStage(p.stage,nextStage,reason);
  if(stageError)throw new Error(stageError);
  const created=nowText();
  const record={projectId:id,visitedAt:values.visitedAt.replace('T',' '),visitors,participants:(values.participants||'').trim(),content:values.content.trim(),nextPlan:(values.nextPlan||'').trim(),author:state.user.name,created};
  (projectVisits[id]||=[]).push(record);
  if(p.stage!==nextStage){
    const before=structuredClone(p);p.stage=nextStage;
    (projectChanges[id]||=[]).push({before,after:structuredClone(p),actor:state.user.name,time:created,reason});
  }
  p.updated=created;
  return record;
}
function projectVisitsMarkup(p) {
  const records=[...(projectVisits[p.id]||[])].sort((a,b)=>b.visitedAt.localeCompare(a.visitedAt)||b.created.localeCompare(a.created));
  return `<section class="project-visits"><div class="section-title"><div><h2>项目跟进记录</h2><p>仅关联当前项目，记录每次跟进沟通；项目阶段在新增跟进记录时维护</p></div>${canEdit()?`<button class="btn primary" data-add-project-visit="${esc(p.id)}">${icons.plus}新增跟进记录</button>`:''}</div>${records.length?`<ol class="project-visit-timeline" aria-label="项目跟进时间轴">${records.map(record=>`<li class="project-visit-event"><div class="project-visit-time"><time datetime="${esc(record.visitedAt.replace(' ','T'))}">${esc(record.visitedAt)}</time></div><article class="project-visit-card"><div class="project-visit-head"><h3>跟进沟通记录</h3><span>记录人：${esc(record.author)} · 创建时间：${esc(record.created)}</span></div><dl class="project-visit-details"><dt>拜访人员</dt><dd>${record.visitors.map(personInfoMarkup).join('、')}</dd><dt>客户参与人</dt><dd>${esc(record.participants||'未填写')}</dd><dt>沟通内容</dt><dd>${esc(record.content)}</dd><dt>下一步计划</dt><dd>${esc(record.nextPlan||'未填写')}</dd></dl></article></li>`).join('')}</ol>`:`<div class="project-visits-empty">暂无跟进记录${canEdit()?'<p>新增第一条记录，沉淀项目的沟通内容与阶段变化。</p>':'<p>该项目尚未添加跟进沟通记录。</p>'}</div>`}</section>`;
}
function openProjectVisitEditor(id) {
  if(!canEdit()||!permittedProjects().some(p=>p.id===id))return;
  const p=permittedProjects().find(project=>project.id===id);
  modal('新增跟进记录',`<div class="visit-form-grid"><div class="field"><label for="visit-time">跟进时间 *</label><input class="input" id="visit-time" type="datetime-local" value="${nowText().replace(' ','T')}"></div><div class="field"><label for="visit-stage">项目阶段</label><select class="select" id="visit-stage">${stages.map(stage=>`<option ${p.stage===stage?'selected':''}>${stage}</option>`).join('')}</select></div><div class="field visit-participant-field"><label for="visit-participants">客户参与人（可选）</label><input class="input" id="visit-participants" placeholder="姓名及职位"></div></div><div class="field"><label for="visit-content">跟进内容 *</label><textarea class="textarea" id="visit-content" placeholder="记录沟通要点、客户反馈、阶段调整原因及待解决问题"></textarea></div><div class="field"><label for="visit-next">下一步计划（可选）</label><textarea class="textarea" id="visit-next" placeholder="记录后续行动及计划时间"></textarea></div><div id="visit-error" class="field-error" role="alert"></div>`,'保存记录',()=>{
    try {
      commitProjectVisit(id,{visitedAt:$('#visit-time').value,stage:$('#visit-stage').value,stageReason:$('#visit-content').value,participants:$('#visit-participants').value,content:$('#visit-content').value,nextPlan:$('#visit-next').value});
    } catch(error) { $('#visit-error').textContent=error.message;return false; }
    state.detailTab='visits';render();toast('跟进记录已保存（本次会话内生效）');
  });
}
const vehicleModelCatalog = {牵引车:['牵引车','矿卡','自卸车'],挂车:['平板半挂车','集装箱骨架半挂车','厢式半挂车','仓栅半挂车','冷藏半挂车','后翻自卸半挂车','侧翻自卸半挂车','油罐半挂车','粉粒物料罐半挂车','液体罐式半挂车','车辆运输半挂车','木材运输半挂车','大件运输特种半挂车']};
function vehicleModelControl(kind,value,id,dataValue=false) {
  if(kind==='牵引车'&&!value)value='牵引车';
  const models=vehicleModelCatalog[kind]||[],custom=!!value&&!models.includes(value);
  if(kind==='挂车') {
    const selectedModel=models.includes(value)?value:models[0];
    return `<select class="select" id="${id}" ${dataValue?'data-value="model"':''} data-model-picker>${models.map(model=>`<option value="${esc(model)}" ${selectedModel===model?'selected':''}>${esc(model)}</option>`).join('')}</select>`;
  }
  return `<select class="select" id="${id}" ${dataValue?'data-value="model"':''} data-model-picker><option value="">请选择车型</option>${models.map(model=>`<option value="${esc(model)}" ${value===model?'selected':''}>${esc(model)}</option>`).join('')}<option value="__other__" ${custom?'selected':''}>其他</option></select><label for="${id}-other" data-other-label ${custom?'':'hidden'}>其他车型</label><input class="input" id="${id}-other" data-other-model value="${esc(custom?value:'')}" placeholder="请输入其他车型" ${custom?'':'hidden'}><span class="help">演示车型列表，正式字典待确认</span>`;
}
// 容量来自当前演示数据；正式容量字典待确认。
const vehicleBatteryCatalog=['400kWh','600kWh'];
function vehicleSpecControl(kind,value,id,dataValue=false) {
  const attribute=dataValue?'data-value="spec"':'';
  if(kind==='挂车')return `<input class="input" id="${id}" ${attribute} type="number" min="1" step="1" value="${esc(value||'')}">`;
  const options=[...vehicleBatteryCatalog];
  if(value&&value!=='—'&&!options.includes(value))options.push(value);
  return `<select class="select" id="${id}" ${attribute}><option value="">请选择电池容量</option>${options.map(capacity=>`<option value="${esc(capacity)}" ${value===capacity?'selected':''}>${esc(capacity)}</option>`).join('')}</select>`;
}
function readVehicleModel(select) {
  // 类型切换事件先读取旧表单；非挂车旧表单没有车型控件。
  if(!select)return '';
  return select.value==='__other__'?(select.id?document.getElementById(select.id+'-other'):select.closest('.field').querySelector('[data-other-model]')).value.trim():select.value.trim();
}
function bindVehicleModelPickers(root=document) {
  $$('[data-model-picker]',root).forEach(select=>{
    const field=select.closest('.field'),input=document.getElementById(select.id+'-other'),label=field.querySelector('[data-other-label]');
    if(!input||!label)return;
    let extra=null;
    if(field.parentElement.classList.contains('demand-fields')){
      extra=document.createElement('div');extra.className='field demand-other-field';extra.hidden=select.value!=='__other__';
      extra.append(label,input);field.after(extra);
    }
    select.onchange=()=>{const other=select.value==='__other__';if(extra)extra.hidden=!other;label.hidden=!other;input.hidden=!other;if(other)input.focus();};
  });
}
function permittedProjects() {
  if (!state.user || isAdmin()) return [];
  return projects.filter(p => isExecutive() || (isDirector() ? p.region === state.user.region : p.owner === state.user.name || p.members.includes(state.user.name)));
}
function normalizeSecondPrecision(value) {
  if(!value)return value;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value+' 00:00:00';
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))return value+':00';
  return value;
}
function nowText() { return new Date().toLocaleString('sv-SE').slice(0,19); }
function vehicleTotals(rows) { return {tractor:rows.filter(v=>v.kind!=='挂车').reduce((n,v)=>n+v.qty,0),trailer:rows.filter(v=>v.kind==='挂车').reduce((n,v)=>n+v.qty,0)}; }
function initializeVehicleData() {
  const seeds = {
    '001':[['牵引车','创维','NJL4250KEKBEV','600kWh',20,'港区短倒'],['挂车','海岳车辆','13米平板半挂车','3',20,'与牵引车配套']],
    '002':[['牵引车','创维','NJL4250KELEV','500kWh',12,'冷链干线']],
    '003':[['牵引车','创维','NJL4250KEKBEV','600kWh',30,'一期需求'],['挂车','申港车辆','SG9400骨架半挂车','3',35,'含备用挂车']],
    '004':[['牵引车','创维','NJL4250KJEV','420kWh',18,'封闭场景']],
    '006':[['牵引车','创维','NJL4250KELEV','500kWh',40,'示范车队']],
    '007':[['牵引车','创维','NJL4250KJEV','520kWh',16,'山区线路适配']],
    '008':[['牵引车','创维','NJL4250KELEV','350kWh',10,'二期扩容',10],['挂车','新源车辆','厢式半挂车','2',10,'城配场景',10]],
    '009':[['牵引车','创维','NJL4250KEKBEV','500kWh',8,'市场调研车型']],
    '010':[['牵引车','创维','NJL4250KELEV','600kWh',15,'联合评审方案'],['挂车','海岳车辆','13米平板半挂车','3',15,'与牵引车配套']],
    '011':[['牵引车','创维','NJL4250KELEV','600kWh',18,'签约首批车辆',0],['挂车','海岳车辆','低栏半挂车','3',18,'签约配套挂车',0]],
    '012':[['牵引车','创维','NJL4250KEKBEV','600kWh',12,'尽调候选车型'],['挂车','海岳车辆','SG9400骨架半挂车','3',12,'港区配套']],
    '013':[['牵引车','创维','NJL4250KELEV','600kWh',20,'签约首批车辆',0],['挂车','海岳车辆','低栏半挂车','3',20,'干线配套',0]],
    '014':[['牵引车','创维','NJL4250KEKBEV','600kWh',15,'已交车投运',15],['挂车','海岳车辆','SG9400骨架半挂车','3',15,'已配套交付',15]]
  };
  for(const [suffix,rows] of Object.entries(seeds)) vehicleRows['PRJ-DEMO-'+suffix]=rows.map(([kind,brand,model,spec,qty,note,deliveredQty])=>({kind,brand,model,battery:kind!=='挂车'?spec:'—',axle:kind==='挂车'?spec:'—',qty,note,deliveredQty:deliveredQty??null}));
  projects.forEach(p=>Object.assign(p,vehicleTotals(vehicleRows[p.id]||[])));
}
function fieldByLabel(form,text) { return [...form.querySelectorAll('.field')].find(f=>f.querySelector('label')?.textContent.startsWith(text)); }
function prepareProjectForm() {
  const form=$('#project-form'); if(!form)return;
  // 项目资料统一在详情页的独立模块维护，项目表单不再提供重复入口。
  [...form.querySelectorAll('.form-section')]
    .find(section=>section.querySelector('h2')?.textContent.trim()==='项目资料')
    ?.remove();
  const id=currentRoute().includes('/edit')?currentRoute().split('/')[2]:null;
  const p=projects.find(p=>p.id===id);
  projectDraft={id,rows:structuredClone(vehicleRows[id]||[])};
  for(const [label,name] of [['项目成员','members'],['项目类型','type'],['项目来源','source'],['项目地点','place'],['项目简介','background']]) {
    const f=fieldByLabel(form,label),control=f?.querySelector('input,select,textarea'); if(!control)continue;
    control.id='project-'+name; f.querySelector('label').htmlFor=control.id;
    if(name==='background')control.value=p?.background||'';
  }
  for(const [id,name] of [['project-name','name'],['project-customer','customer'],['project-owner','owner'],['project-region','region']]) {
    const control=$('#'+id); const label=control.closest('.field').querySelector('label'); label.htmlFor=id;
    control.setAttribute('aria-describedby',id==='project-name'?'name-error':id+'-error');
    if(id!=='project-name')control.insertAdjacentHTML('afterend',`<div class="field-error" id="${id}-error"></div>`);
  }
  const dimensionSelects=$$('.dimension-card select',form);
  dimensionSelects.forEach((control,i)=>{control.id=['stage-select','project-status','project-eco'][i];control.setAttribute('aria-label',['项目阶段','项目状态','生态项目进度'][i]);});
  // 新建阶段固定10%；编辑推进在保存时校验，不能绕过跨级/降级规则。
  $('#stage-select').disabled=!p;
  $('.dimension-grid',form).insertAdjacentHTML('beforeend','<div class="field stage-reason-field"><label for="stage-reason">阶段变更原因（跨级、降级或纠错必填）</label><textarea class="textarea" id="stage-reason"></textarea><div class="field-error" id="stage-error"></div></div>');
  const owner=$('#project-owner'),region=$('#project-region'),members=$('#project-members');
  members.value=[...new Set([p?.owner||owner.value,...(p?.members||[])])].filter(Boolean).join('、');
  const teamField=members.closest('.field'),ownerField=owner.closest('.field');
  const teamGroup=document.createElement('div');teamGroup.className='project-team-editor';
  const grid=teamField.parentElement;
  teamGroup.append(teamField);
  teamField.querySelector('label').classList.add('required');
  owner.hidden=true;
  teamField.append(owner,$('#project-owner-error'));
  ownerField.remove();
  teamGroup.insertAdjacentHTML('beforeend','<div class="help">可多选项目成员；已选成员可设为主负责人，主负责人仅一位。</div>');
  for(const id of ['project-name','project-customer','project-region','project-type','project-source','project-place'])grid.append($('#'+id).closest('.field'));
  grid.append(teamGroup,$('#project-background').closest('.field'));
  const locked=Boolean(p&&!isDirector());
  if(locked){owner.disabled=true;members.disabled=true;region.disabled=true;}
  const selectedNames=members.value.split('、').filter(Boolean);
  let primary=selectedNames.includes(p?.owner||owner.value)?(p?.owner||owner.value):(selectedNames[0]||'');
  members.type='hidden';
  const picker=document.createElement('details');picker.className='project-member-picker project-team-picker';
  picker.innerHTML=`<summary aria-label="选择项目成员（支持多选）"><span></span><span aria-hidden="true">⌄</span></summary><div class="project-member-options customer-owner-options" role="group" aria-label="项目成员选项">${users.map(person=>`<div class="customer-owner-option"><label><input type="checkbox" value="${esc(person.name)}" ${selectedNames.includes(person.name)?'checked':''} ${locked?'disabled':''}><span>${esc(person.name)}<small>${esc(person.role)} · ${esc(person.region)}</small></span></label><button type="button" class="customer-owner-primary-action" data-project-primary="${esc(person.name)}" hidden>设为主要</button></div>`).join('')}</div>`;
  members.after(picker);
  teamField.querySelector('label').removeAttribute('for');
  if(locked){picker.classList.add('is-disabled');picker.querySelector('summary').setAttribute('aria-disabled','true');picker.querySelector('summary').onclick=event=>event.preventDefault();}
  let join;
  const refreshTeam=()=>{
    const names=[...picker.querySelectorAll('input:checked')].map(input=>input.value);
    if(!names.includes(primary))primary=names[0]||'';
    members.value=names.join('、');
    owner.innerHTML=names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    owner.value=primary;
    owner.setAttribute('aria-label','项目主负责人');
    if(!p&&primary){const primaryUser=users.find(user=>user.name===primary);if(primaryUser)region.value=primaryUser.region;}
    picker.querySelector('summary > span').innerHTML=names.length?names.map(name=>`${esc(name)}${name===primary?'<em>主要</em>':''}`).join('<b>、</b>'):'请选择项目成员';
    picker.querySelectorAll('.customer-owner-option').forEach(row=>{
      const checkbox=row.querySelector('input'),action=row.querySelector('[data-project-primary]'),isPrimary=checkbox.value===primary;
      action.hidden=!checkbox.checked||(locked&&!isPrimary);
      action.disabled=locked||isPrimary;
      action.textContent=isPrimary?'主要':'设为主要';
      action.classList.toggle('is-primary',isPrimary);
    });
    if(join){join.checked=names.includes(state.user.name);join.closest('label').hidden=primary===state.user.name;}
  };
  picker.querySelectorAll('input').forEach(checkbox=>checkbox.addEventListener('change',refreshTeam));
  picker.querySelectorAll('[data-project-primary]').forEach(action=>action.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();primary=action.dataset.projectPrimary;refreshTeam();}));
  picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});
  if(!p){
    picker.insertAdjacentHTML('afterend','<label id="join-row" hidden><input type="checkbox" id="join-project"> 将我加入项目</label>');
    join=$('#join-project');
    join.addEventListener('change',()=>{const ownCheckbox=[...picker.querySelectorAll('input')].find(input=>input.value===state.user.name);if(ownCheckbox){ownCheckbox.checked=join.checked;refreshTeam();}});
  }
  refreshTeam();
  // 候选客户也服从数据范围；不从表单泄露其他客户名单。
  const allowed=visibleCustomers(); $('#project-customer').innerHTML='<option value="">请选择</option>'+allowed.map(c=>`<option value="${esc(c.short)}" ${p?.customer===c.short?'selected':''}>${esc(c.short)}</option>`).join('');
  renderDraftVehicles();
}
function renderDraftVehicles() {
  if(!projectDraft||!$('#vehicle-body'))return;
  $('#vehicle-body').innerHTML=projectDraft.rows.length?projectDraft.rows.map((v,i)=>`<tr><td>${v.kind}</td><td>${esc(v.brand)}</td><td>${esc(v.model)}</td><td>${esc(v.kind!=='挂车'?v.battery:v.axle+'轴')}</td><td class="num">${v.qty}</td><td>${esc(v.note)}</td><td><button type="button" class="btn ghost small" data-edit-vehicle="${i}">编辑</button><button type="button" class="btn ghost small" data-delete-vehicle="${i}">删除</button></td></tr>`).join(''):'<tr class="empty-row"><td colspan="7" style="height:100px">车辆需求待完善</td></tr>';
  const totals=vehicleTotals(projectDraft.rows);$('#tractor-total').textContent=totals.tractor;$('#trailer-total').textContent=totals.trailer;
  bindVehicleActions();
}
function bindVehicleActions() {
  $$('[data-edit-vehicle]').forEach(b=>b.onclick=()=>editVehicle(Number(b.dataset.editVehicle)));
  $$('[data-delete-vehicle]').forEach(b=>b.onclick=()=>{
    const index=Number(b.dataset.deleteVehicle),v=projectDraft.rows[index];
    modal('删除车辆需求',`确定删除“${esc(v.kind+' · '+v.brand+' '+v.model)}”吗？`,'确认删除',()=>{projectDraft.rows.splice(index,1);renderDraftVehicles();toast('需求已从草稿删除，保存项目后生效');});
  });
}
function editVehicle(index) {
  const v={...(projectDraft.rows[index]||{kind:'牵引车',model:'',battery:'',axle:'',qty:1,note:''}),brand:'创维'};
  modal(index===undefined?'新增计划用车需求':'编辑计划用车需求',`<div class="field"><label for="v-kind">车辆类型</label><select class="select" id="v-kind">${['牵引车','挂车','矿卡','自卸车'].map(kind=>`<option ${v.kind===kind?'selected':''}>${kind}</option>`).join('')}</select></div>${[['brand','品牌',v.brand],['model','车型',v.model],['spec','电池容量 / 轴数',v.kind!=='挂车'?v.battery:v.axle],['qty','数量',v.qty],['note','备注',v.note]].filter(([name])=>name!=='model'||v.kind==='挂车').map(([name,label,value])=>`<div class="field" style="margin-top:12px"><label for="v-${name}">${label}</label>${name==='model'?vehicleModelControl(v.kind,value,'v-model'):name==='spec'?vehicleSpecControl(v.kind,value,'v-spec'):`<input class="input" id="v-${name}" value="${esc(value)}" ${name==='qty'?'type="number" min="1" step="1"':''}>`}</div>`).join('')}<div id="vehicle-error" class="field-error" role="alert"></div>`,'保存需求',()=>{
    const kind=$('#v-kind').value,brand=$('#v-brand').value.trim(),model=kind==='挂车'?readVehicleModel($('#v-model')):(v.model||''),spec=$('#v-spec').value.trim(),qty=Number($('#v-qty').value);
    if(!brand||(kind==='挂车'&&!model)||!spec||!Number.isInteger(qty)||qty<=0||(kind==='挂车'&&(!Number.isInteger(Number(spec))||Number(spec)<=0))){$('#vehicle-error').textContent='请填写品牌、车型和规格；数量、挂车轴数必须为大于0的整数。';return false;}
    const row={...v,kind,brand,model,battery:kind!=='挂车'?spec:'—',axle:kind==='挂车'?String(Number(spec)):'—',qty,note:$('#v-note').value.trim()};
    if(index===undefined)projectDraft.rows.push(row);else projectDraft.rows[index]=row;
    renderDraftVehicles();toast('需求草稿已更新，保存项目后生效');
  });
  const updateLabel=()=>{$('[for="v-spec"]').textContent=$('#v-kind').value!=='挂车'?'电池容量（kWh）':'轴数（大于0的整数）';};
  $('#v-kind').onchange=()=>{const kind=$('#v-kind').value;$('#v-brand').value='创维';const specField=$('#v-spec').closest('.field');specField.innerHTML='<label for="v-spec"></label>'+vehicleSpecControl(kind,'','v-spec');$('#v-model')?.closest('.field').remove();if(kind==='挂车')specField.insertAdjacentHTML('beforebegin','<div class="field"><label for="v-model">车型</label>'+vehicleModelControl(kind,'','v-model')+'</div>');bindVehicleModelPickers();updateLabel();};updateLabel();bindVehicleModelPickers();
}
function validateStage(oldStage,nextStage,reason) {
  const from=stages.indexOf(oldStage),to=stages.indexOf(nextStage);
  if(to<0)return '请选择有效阶段';
  if(to<from&&!isDirector())return '只有大区总监可以降级或纠错';
  if((to<from||to>from+1)&&!reason.trim())return '跨级、降级或纠错必须填写原因';
  return '';
}
function saveProjectForm(event) {
  event.preventDefault();
  if(!projectDraft)return;
  const existing=projectDraft.id?projects.find(p=>p.id===projectDraft.id):null;
  if(!canEdit()||(existing&&!permittedProjects().includes(existing))){toast('无权保存该项目','error');return;}
  let invalid=false;
  for(const id of ['project-name','project-customer','project-owner','project-region']){
    const control=$('#'+id),error=$(id==='project-name'?'#name-error':'#'+id+'-error');
    error.textContent=control.value.trim()?'':'请填写或选择此项';control.setAttribute('aria-invalid',control.value.trim()?'false':'true');
    if(!control.value.trim()){if(!invalid)control.focus();invalid=true;}
  }
  const reason=$('#stage-reason').value.trim(),stage=existing?$('#stage-select').value:stages[0];
  const stageError=existing?validateStage(existing.stage,stage,reason):'';$('#stage-error').textContent=stageError;if(invalid||stageError)return;
  const owner=$('#project-owner').value;
  const members=[...new Set($('#project-members').value.split(/[、,，]/).map(s=>s.trim()).filter(Boolean))].filter(name=>name!==owner);
  if(members.some(name=>!users.some(u=>u.name===name))){toast('项目成员必须为现有用户姓名，多个姓名用顿号分隔','error');return;}
  if(!existing&&owner!==state.user.name&&$('#join-project').checked)members.push(state.user.name);
  const id=existing?.id||'PRJ-DEMO-'+String(Math.max(0,...projects.map(p=>Number(p.id.split('-').at(-1))))+1).padStart(3,'0');
  const before=existing?structuredClone(existing):null;
  const beforeVehicles=structuredClone(vehicleRows[id]||[]);
  const next={...(existing||{}),id,name:$('#project-name').value.trim(),customer:$('#project-customer').value,owner,members:[...new Set(members)],region:$('#project-region').value,stage,status:$('#project-status').value,eco:$('#project-eco').value,type:$('#project-type').value,source:$('#project-source').value,place:$('#project-place').value.trim(),background:$('#project-background').value.trim(),created:existing?.created||(!existing?nowText():undefined),updated:nowText(),...vehicleTotals(projectDraft.rows)};
  // 再检查非总监编辑时不可修改负责关系。
  if(existing&&!isDirector()&&(next.owner!==existing.owner||next.region!==existing.region||JSON.stringify(next.members)!==JSON.stringify(existing.members))){toast('无权调整负责人、成员或大区','error');return;}
  if(!visibleCustomers().some(c=>c.short===next.customer)){toast('无权选择该客户','error');return;}
  const btn=$('#save-project');btn.disabled=true;btn.textContent='保存中…';
  vehicleRows[id]=structuredClone(projectDraft.rows);
  if(existing)Object.assign(existing,next);else projects.push(next);
  syncModelDeliveries(existing||next,vehicleRows[id]);
  (projectChanges[id]||=[]).push({before,after:structuredClone(next),actor:state.user.name,time:next.updated,reason,beforeVehicles,vehicles:structuredClone(vehicleRows[id])});
  const accessible=permittedProjects().some(p=>p.id===id);
  projectDraft=null;
  toast(accessible?'项目已保存（本次会话内生效）':'项目已保存；你未加入该项目，返回项目列表');
  go(accessible?'/projects/'+id:'/projects');
}
function maintainProjectStage() {
  const p=projects.find(p=>p.id===currentRoute().split('/')[2]);if(!p||!canEdit()||!permittedProjects().includes(p))return;
  modal('维护项目阶段',`<div class="field"><label for="maintain-stage">目标阶段</label><select class="select" id="maintain-stage">${stages.map(s=>`<option ${p.stage===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label for="maintain-reason">变更原因（跨级、降级或纠错必填）</label><textarea class="textarea" id="maintain-reason"></textarea></div><div class="field-error" id="maintain-error" role="alert"></div>`,'保存变更',()=>{
    const next=$('#maintain-stage').value,reason=$('#maintain-reason').value.trim(),error=validateStage(p.stage,next,reason);
    if(error){$('#maintain-error').textContent=error;return false;}
    if(p.stage===next)return;
    const before=structuredClone(p);p.stage=next;p.updated=nowText();
    (projectChanges[p.id]||=[]).push({before,after:structuredClone(p),actor:state.user.name,time:p.updated,reason});
    render();toast('项目阶段已更新（本次会话内生效）');
  });
}
function projectHistory(id) {
  const records=projectChanges[id]||[];
  return `<section class="panel detail-panel"><div class="section-title"><h2>项目修改记录</h2></div>${records.length?records.slice().reverse().map(r=>`<div class="timeline-item"><div class="timeline-title">${r.before?'保存项目修改':'创建项目'}</div><div class="timeline-meta">${esc(r.actor)} · ${esc(r.time)}</div>${['stage','eco'].filter(k=>r.before?.[k]!==r.after[k]).map(k=>`<div>${k==='stage'?'阶段':'生态进度'}：${esc(r.before?.[k]||'未设置')} → ${esc(r.after[k]||'未设置')}</div>`).join('')}${r.vehicles?`<div>计划用车：牵引车 ${r.before?.tractor||0} → ${r.after.tractor} 辆；挂车 ${r.before?.trailer||0} → ${r.after.trailer} 辆</div>`:''}${r.reason?`<div class="timeline-note">原因：${esc(r.reason)}</div>`:''}</div>`).join(''):'<div class="help">本次会话暂无修改记录，演示数据未提供历史记录。</div>'}</section>`;
}
function validateDemandRows(rows) {
  return rows.every(v=>['牵引车','挂车','矿卡','自卸车'].includes(v.kind)&&v.brand.trim()&&(v.kind!=='挂车'||v.model.trim())&&Number.isInteger(v.qty)&&v.qty>0&&(v.kind!=='挂车'?v.battery.trim():Number.isInteger(Number(v.axle))&&Number(v.axle)>0));
}
function commitVehicleDemand(id,rows) {
  const p=permittedProjects().find(p=>p.id===id);
  if(!p||!canEdit())throw new Error('无权编辑该项目的用车需求');
  if(!validateDemandRows(rows))throw new Error('请完善车辆需求必填项；数量和挂车轴数须为大于0的整数');
  const before=structuredClone(p),beforeVehicles=structuredClone(vehicleRows[id]||[]);
  vehicleRows[id]=structuredClone(rows);
  Object.assign(p,vehicleTotals(rows),{updated:nowText()});
  syncModelDeliveries(p,rows);
  (projectChanges[id]||=[]).push({before,after:structuredClone(p),beforeVehicles,vehicles:structuredClone(rows),actor:state.user.name,time:p.updated,reason:'单独维护计划用车需求'});
}
function openDemandEditor(id) {
  if(!canEdit()||!permittedProjects().some(p=>p.id===id))return;
  let draft=structuredClone(vehicleRows[id]||[]);
  draft.forEach(row=>{row.brand='创维';});
  const brandControl=(value,controlId)=>{
    const brands=[...new Set(Object.values(vehicleRows).flat().map(v=>v.brand).concat('创维',value).filter(Boolean))];
    return `<select class="select" id="${controlId}" data-value="brand"><option value="">请选择品牌</option>${brands.map(brand=>`<option value="${esc(brand)}" ${brand===value?'selected':''}>${esc(brand)}</option>`).join('')}</select>`;
  };
  const readRows=()=>$$('[data-demand-row]').map((row,i)=>{
    const value=name=>row.querySelector(`[data-value="${name}"]`).value.trim();
    const kind=value('kind');return {...draft[i],kind,brand:value('brand'),model:kind==='挂车'?readVehicleModel(row.querySelector('[data-value="model"]')):(draft[i].model||''),qty:Number(value('qty')),note:value('note'),battery:kind!=='挂车'?value('spec'):'—',axle:kind==='挂车'?value('spec'):'—'};
  });
  const updateSummary=()=>{const totals=vehicleTotals(readRows().filter(v=>Number.isFinite(v.qty)&&v.qty>0));$('#demand-summary').innerHTML=`计划车辆 <span class="demand-total-number">${totals.tractor}</span> 辆 · 挂车 <span class="demand-total-number">${totals.trailer}</span> 辆`;};
  const draw=()=>{
    $('#demand-rows').innerHTML=draft.length?draft.map((v,i)=>`<section class="demand-row" data-demand-row><div class="demand-row-head"><strong>需求 ${i+1}</strong><button class="btn ghost small" type="button" data-demand-remove="${i}">删除需求</button></div><div class="demand-fields"><div class="field"><label for="d-${i}-kind">车辆类型</label><select class="select" id="d-${i}-kind" data-value="kind">${['牵引车','挂车','矿卡','自卸车'].map(kind=>`<option ${v.kind===kind?'selected':''}>${kind}</option>`).join('')}</select></div>${[['brand','品牌',v.brand],['model','车型',v.model],['spec',v.kind!=='挂车'?'电池容量（kWh）':'轴数',v.kind!=='挂车'?v.battery:v.axle],['qty','数量',v.qty],['note','备注（可选）',v.note]].filter(([name])=>name!=='model'||v.kind==='挂车').map(([name,label,value])=>`<div class="field"><label for="d-${i}-${name}">${label}</label>${name==='brand'?brandControl(value,`d-${i}-brand`):name==='model'?vehicleModelControl(v.kind,value,`d-${i}-model`,true):name==='spec'?vehicleSpecControl(v.kind,value,`d-${i}-spec`,true):`<input class="input" id="d-${i}-${name}" data-value="${name}" value="${esc(value)}" ${name==='qty'?'type="number" min="1" step="1"':''}>`}</div>`).join('')}</div></section>`).join(''):'<div class="help">暂无用车需求，保存后项目将显示“车辆需求待完善”。</div>';
    $$('[data-demand-remove]').forEach(button=>button.onclick=()=>{
      if(button.dataset.confirm!=='yes'){button.dataset.confirm='yes';button.textContent='确认删除此需求';return;}
      draft=readRows();draft.splice(Number(button.dataset.demandRemove),1);draw();
    });
    $$('[data-value="kind"]').forEach(select=>select.onchange=()=>{draft=readRows();const i=$$('[data-value="kind"]').indexOf(select);draft[i].brand='创维';draft[i].battery='';draft[i].axle='';draft[i].model='';draw();});
    $$('[data-demand-row] input').forEach(input=>input.oninput=updateSummary);
    bindVehicleModelPickers($('#demand-rows'));updateSummary();
  };
  modal('编辑计划用车需求','<div class="demand-toolbar"><strong id="demand-summary"></strong><button class="btn primary" type="button" id="demand-add">+ 新增需求</button></div><div id="demand-rows"></div><div class="field-error" id="demand-error" role="alert"></div>','保存',()=>{
    try{commitVehicleDemand(id,readRows());}catch(error){$('#demand-error').textContent=error.message;return false;}
    render();toast('用车需求已保存，项目其他信息未修改');
  });
  $('#demand-rows').closest('.modal').classList.add('demand-modal');
  $('#demand-add').onclick=()=>{draft=readRows();draft.push({kind:'牵引车',brand:'创维',model:'',battery:'',axle:'',qty:1,note:''});draw();};
  draw();
}
let contactDraft=[];
const demoCustomerContacts={
  'CUST-001':[
    {name:'示例联系人A',title:'运营总监',phone:'000-0000-0001',primary:true},
    {name:'示例联系人J',title:'财务经理',phone:'000-0000-0010',primary:false}
  ]
};
function contactsFor(c) {
  return structuredClone(c?.contacts||demoCustomerContacts[c?.id]||(c?.contact?[{name:c.contact,title:c.title||'',phone:c.phone||'',primary:true}]:[]));
}
function upsertContact(rows,contact,index) {
  if(!contact.name.trim())throw new Error('请输入联系人姓名');
  const result=structuredClone(rows);
  if(contact.primary)result.forEach(c=>c.primary=false);
  if(index===undefined)result.push({...contact});else result[index]={...contact};
  return result;
}
function prepareContactDraft() {
  if(!$('#customer-form'))return;
  const c=customers.find(c=>c.id===currentRoute().split('/')[2]);contactDraft=contactsFor(c);
  drawContactDraft();
}
function drawContactDraft() {
  $('#contact-body').innerHTML=contactDraft.length?contactDraft.map((c,i)=>`<tr><td>${esc(c.name)}</td><td>${esc(c.title||'—')}</td><td>${esc(c.phone||'—')}</td><td>${c.primary?'<span class="tag success">主联系人</span>':'—'}</td><td><button type="button" class="btn ghost small" data-edit-contact="${i}">编辑</button>${!c.primary?`<button type="button" class="btn ghost small" data-set-primary-contact="${i}">设为主联系人</button>`:''}</td></tr>`).join(''):'<tr><td colspan="5">暂无联系人</td></tr>';
  $$('[data-edit-contact]').forEach(b=>b.onclick=()=>openContactEditor(Number(b.dataset.editContact)));
  $$('[data-set-primary-contact]').forEach(b=>b.onclick=()=>{
    const index=Number(b.dataset.setPrimaryContact);
    contactDraft.forEach((contact,i)=>contact.primary=i===index);
    drawContactDraft();toast('已设为主联系人，保存客户后生效');
  });
}
function openContactEditor(index) {
  const c=contactDraft[index]||{name:'',title:'',phone:'',primary:false};
  modal(index===undefined?'新增联系人':'编辑联系人',`${[['name','姓名',c.name],['title','职位',c.title],['phone','手机号',c.phone]].map(([key,label,value])=>`<div class="field" style="margin-bottom:12px"><label ${key==='name'?'class="required"':''} for="contact-${key}">${label}</label><input class="input" id="contact-${key}" value="${esc(value)}" ${key==='phone'?'type="tel"':''}></div>`).join('')}<label><input id="contact-primary" type="checkbox" ${c.primary?'checked':''}> 设为主联系人</label><div class="field-error" id="contact-error" role="alert"></div>`,index===undefined?'新增':'保存',()=>{
    const next={name:$('#contact-name').value.trim(),title:$('#contact-title').value.trim(),phone:$('#contact-phone').value.trim(),primary:$('#contact-primary').checked};
    const replaced=next.primary&&contactDraft.some((c,i)=>c.primary&&i!==index);
    try{contactDraft=upsertContact(contactDraft,next,index);}catch(error){$('#contact-error').textContent=error.message;$('#contact-name').focus();return false;}
    drawContactDraft();toast(replaced?'已设为主联系人，原主联系人已取消；保存客户后生效':'联系人草稿已更新，保存客户后生效');
  });
}
function saveCustomerWithContacts(event) {
  event.preventDefault();
  const form=$('#customer-form'),id=currentRoute().includes('/edit')?currentRoute().split('/')[2]:null;
  const existing=customers.find(c=>c.id===id);
  if(!canEdit()||(id&&(!existing||!visibleCustomers().includes(existing)))){toast('无权保存客户','error');return;}
  const get=label=>fieldByLabel(form,label).querySelector('input,select,textarea').value.trim();
  const name=get('客户名称'),owner=$('#customer-primary-owner')?.value||get('客户负责人'),region=get('所属大区');
  if(!name||!owner||!region){toast('请填写客户名称、负责人和大区','error');$('#customer-name').focus();return;}
  const selectedOwners=($('#customer-business-owners')?.value||owner).split('、').filter(Boolean),businessOwners=[owner,...selectedOwners.filter(name=>name!==owner)];
  const primary=contactDraft.find(c=>c.primary);
  const next={...(existing||{}),id:existing?.id||'CUST-'+String(Math.max(...customers.map(c=>Number(c.id.split('-')[1])))+1).padStart(3,'0'),name,short:existing?.short||name,owner,businessOwners,region,industry:get('所属行业')==='请选择'?'':get('所属行业'),capital:get('注册资本'),address:get('客户地址'),brief:get('客户简介'),creditCode:get('统一社会信用代码'),enterpriseType:get('企业类型'),legalPerson:get('法定代表人'),registeredAt:get('成立日期'),enterpriseStatus:get('企业状态'),scope:get('经营范围'),registrationNumber:get('工商注册号'),taxpayerId:get('纳税人识别号'),organizationCode:get('组织机构代码'),businessTerm:get('营业期限'),taxpayerQualification:get('纳税人资质'),approvedAt:get('核准日期'),nationalIndustry:get('国标行业'),staffSize:get('人员规模'),insuredCount:get('参保人数'),englishName:get('英文名称'),registrationAuthority:get('登记机关'),registeredAddress:get('注册地址'),mailingAddress:get('通信地址'),businessPhone:get('联系电话'),shareholders:get('股东'),controller:get('实际控制人'),externalRiskSnapshot:form.businessQueryResult||existing?.externalRiskSnapshot, businessInfoUpdatedAt:form.businessQueryResult?.queriedAt||existing?.businessInfoUpdatedAt,contacts:structuredClone(contactDraft),contact:primary?.name||'',title:primary?.title||'',phone:primary?.phone||'',updated:nowText()};
  next.created=existing?existing.created||'':next.updated;
  if(existing)Object.assign(existing,next);else customers.push(next);
  toast('客户与联系人已保存（本次会话内生效）');go('/customers');
}
function projectCustomerLink(p) {
  const customer=visibleCustomers().find(c=>c.short===p.customer||c.name===p.customer);
  return customer?`<a class="project-customer-link" href="#/customers/${esc(customer.id)}">${esc(p.customer)}</a>`:esc(p.customer);
}
function personInfoMarkup(name) {
  const person=users.find(u=>u.name===name)||{};
  const fields=[['姓名',name],['归属部门',person.department||person.dept],['职位',person.position],['联系电话',person.phone],['系统角色',person.role],['所属大区',person.region]];
  return `<span class="person-info"><button type="button" class="person-info-trigger" aria-label="查看${esc(name)}的人员信息">${esc(name)}</button><span class="person-info-card" role="tooltip">${fields.map(([label,value])=>`<span class="person-info-field"><span>${label}</span><span>${esc(value||'未提供')}</span></span>`).join('')}</span></span>`;
}
function customerContactsMarkup(c) {
  const contacts=contactsFor(c);
  return `<div class="customer-contact-toolbar"><span>${contacts.length} 位联系人</span>${canEdit()?`<button type="button" class="btn ghost small" data-detail-contact-add>${icons.plus}新增联系人</button>`:''}</div>${contacts.length?`<div class="customer-contact-list">${contacts.map((person,index)=>`<article class="customer-contact-card"><div class="customer-contact-head"><strong>${esc(person.name)}</strong><div class="customer-contact-head-action">${person.primary?'<span class="tag success">主联系人</span>':canEdit()?`<button type="button" class="btn ghost small customer-set-primary" data-detail-contact-primary="${index}">设为主联系人</button>`:''}</div></div><dl><div><dt>职位</dt><dd>${esc(person.title||'未填写')}</dd></div><div><dt>联系方式</dt><dd>${esc(person.phone||'未填写')}</dd></div></dl></article>`).join('')}</div>`:'<div class="help">暂无联系人</div>'}`;
}
function commitCustomerContacts(customer,contacts) {
  customer.contacts=structuredClone(contacts);
  const primary=contacts.find(contact=>contact.primary);
  customer.contact=primary?.name||'';
  customer.title=primary?.title||'';
  customer.phone=primary?.phone||'';
  customer.updated=nowText();
}
function openCustomerDetailContactEditor(customer,index) {
  const contacts=contactsFor(customer),contact=contacts[index]||{name:'',title:'',phone:'',primary:contacts.length===0};
  modal(index===undefined?'新增联系人':'编辑联系人',`${[['name','姓名',contact.name],['title','职位',contact.title],['phone','联系方式',contact.phone]].map(([key,label,value])=>`<div class="field" style="margin-bottom:12px"><label ${key==='name'?'class="required"':''} for="detail-contact-${key}">${label}</label><input class="input" id="detail-contact-${key}" value="${esc(value)}" ${key==='phone'?'type="tel"':''}></div>`).join('')}<label><input id="detail-contact-primary" type="checkbox" ${contact.primary?'checked':''}> 设为主联系人</label><div class="field-error" id="detail-contact-error" role="alert"></div>`,index===undefined?'新增':'保存',()=>{
    const next={name:$('#detail-contact-name').value.trim(),title:$('#detail-contact-title').value.trim(),phone:$('#detail-contact-phone').value.trim(),primary:$('#detail-contact-primary').checked};
    let updated;
    try{updated=upsertContact(contacts,next,index);}catch(error){$('#detail-contact-error').textContent=error.message;$('#detail-contact-name').focus();return false;}
    commitCustomerContacts(customer,updated);render();toast(index===undefined?'联系人已新增':'联系人已更新');
  });
}
function bindCustomerContactDetailActions() {
  const match=/^\/customers\/([^/]+)$/.exec(currentRoute());
  if(!match)return;
  const customer=customers.find(item=>item.id===match[1]);
  if(!customer)return;
  const addButton=$('[data-detail-contact-add]');
  addButton?.addEventListener('click',()=>openCustomerDetailContactEditor(customer));
  $$('[data-detail-contact-primary]').forEach(button=>button.onclick=()=>{
    const index=Number(button.dataset.detailContactPrimary),contacts=contactsFor(customer);
    contacts.forEach((contact,i)=>contact.primary=i===index);
    commitCustomerContacts(customer,contacts);render();toast('主要联系人已更新');
  });
}
