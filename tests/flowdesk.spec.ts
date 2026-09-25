import {test,expect} from '@playwright/test';
test.describe.serial('FlowDesk 完整链路',()=>{
 test('Dashboard KPI 与最近流程进入编辑器',async({page})=>{await page.goto('/');await expect(page.getByTestId('kpi-grid')).toBeVisible();await expect(page.getByText('流程总数')).toBeVisible();await expect(page.getByText('异常实例',{exact:true}).first()).toBeVisible();await page.getByTestId('recent-workflow').first().click();await expect(page.getByTestId('flow-canvas')).toBeVisible();});
 test('审批配置、保存和双区域校验',async({page})=>{await page.goto('/workflows/wf-1');await page.getByTestId('canvas-node-approval').click();await expect(page.getByTestId('config-panel')).toContainText('审批配置');await page.getByLabel('审批人来源').selectOption({label:'固定角色'});await page.getByTestId('save-node-config').click();await page.getByRole('button',{name:'保存草稿'}).click();await page.getByTestId('validate-button').click();await expect(page.getByTestId('canvas-node-condition')).toHaveClass(/invalid/);await expect(page.getByTestId('issues-panel')).toContainText('条件分支规则未配置');const before=await page.getByTestId('error-count').textContent();expect(Number(before?.match(/\d+/)?.[0])).toBeGreaterThan(0);await page.getByTestId('canvas-node-condition').click();await page.getByLabel('条件字段').selectOption('amount');await page.getByLabel('条件比较值').fill('5000');await page.getByTestId('save-node-config').click();await page.getByTestId('validate-button').click();await expect(page.getByTestId('error-count')).toContainText('0 错误');});
 test('表单预览金额驱动条件分支',async({page})=>{await page.goto('/workflows/wf-1/preview');await expect(page.getByTestId('branch-result')).toContainText('标准分支');await page.getByLabel('申请金额').fill('12000');await expect(page.getByTestId('branch-result')).toContainText('高额分支');});
 test('发布后列表和总览同步',async({page})=>{await page.goto('/workflows/wf-2');await page.getByTestId('publish-button').click();await expect(page.getByRole('status')).toContainText('发布成功');await page.getByRole('link',{name:'流程管理'}).click();const row=page.getByTestId('workflow-row').filter({hasText:'采购合同审批'});await expect(row).toContainText('已发布');await expect(row).toContainText('v3');await page.getByRole('link',{name:'总览'}).click();await expect(page.getByTestId('kpi-grid')).toBeVisible();});
 test('异常实例详情、时间线与当前节点高亮',async({page})=>{await page.goto('/monitor');await page.getByRole('button',{name:'异常',exact:true}).click();await page.getByTestId('instance-row').first().click();await expect(page.getByTestId('instance-detail')).toBeVisible();await expect(page.getByTestId('execution-timeline')).toContainText('提交申请');await expect(page.locator('.runtime-highlight')).toHaveCount(1);});
 test('版本比较并恢复历史版本',async({page})=>{await page.goto('/workflows/wf-2/versions');await expect(page.getByTestId('version-compare')).toContainText('新增节点');await page.getByTestId('restore-version').click();await expect(page).toHaveURL(/\/workflows\/wf-2$/);await expect(page.getByRole('status')).toContainText('已恢复');await expect(page.getByTestId('flow-canvas')).toBeVisible();});
});

test.describe.serial('受控子流程引用',()=>{
 test('流程列表显示当前版本与待升级项',async({page})=>{await page.goto('/workflows');
  const row14=page.getByTestId('workflow-row').filter({hasText:'采购入职审批'});
  await expect(row14).toContainText('1 引用');
  await expect(row14.getByTestId('ref-upgradable-badge')).toContainText('1 待升级');
  const row17=page.getByTestId('workflow-row').filter({hasText:'外包人员入场审批'});
  await expect(row17.getByTestId('ref-pending-badge')).toContainText('1 待处理');
  const row18=page.getByTestId('workflow-row').filter({hasText:'供应商年度复核'});
  await expect(row18).toContainText('源已归档');
 });

 test('编辑器升级引用到新版本并独立于人事流程',async({page})=>{await page.goto('/workflows/wf-14');
  await expect(page.getByTestId('canvas-ref-count')).toContainText('1 个受控引用');
  await expect(page.getByTestId('canvas-node-s14-ref')).toContainText('锁定 v1');
  const dock=page.getByTestId('ref-dock');
  await expect(dock).toContainText('入职审批（标准）');
  await expect(dock.getByTestId('ref-row')).toContainText('锁定 v1');
  await dock.getByTestId('ref-upgrade').click();
  await expect(page.getByRole('status')).toContainText('已升级到');
  await expect(page.getByTestId('canvas-node-s14-ref')).toContainText('锁定 v2');
  await expect(dock.getByTestId('ref-row')).toContainText('当前版本');
  // 人事流程是另一份独立引用，不跟着升级
  await page.goto('/workflows/wf-15');
  await expect(page.getByTestId('canvas-node-s15-ref')).toContainText('锁定 v1');
  await expect(page.getByTestId('ref-upgrade')).toBeVisible();
 });

 test('升级预检不通过时留在待处理并列出缺口',async({page})=>{await page.goto('/workflows/wf-17');
  const gaps=page.getByTestId('ref-gaps');
  await expect(gaps).toContainText('接入点缺失：子流程没有下游连线');
  await expect(gaps).toContainText('缺少结束节点');
  await page.getByTestId('ref-retry').first().click();
  await expect(page.getByRole('status')).toContainText('缺口');
  await expect(page.getByTestId('canvas-node-s17-ref')).toContainText('锁定 v1');
  // 放弃升级后回到插入版本、不再有待处理标记
  await page.getByTestId('ref-dismiss').click();
  await expect(page.getByRole('status')).toContainText('保留在插入版本');
 });

 test('版本历史显示引用状态与各发布版本锁定项',async({page})=>{await page.goto('/workflows/wf-14/versions');
  const dock=page.getByTestId('ref-dock');
  await expect(dock).toContainText('可升级');
  await expect(page.getByTestId('version-refs').first()).toContainText('入职审批（标准） v1');
 });

 test('复制流程保留受控引用且各走各的版本',async({page})=>{await page.goto('/workflows');
  const row15=page.getByTestId('workflow-row').filter({hasText:'人事入职审批'});
  await row15.getByTitle('复制（保留受控引用）').click();
  await expect(page.getByRole('status')).toContainText('保留 1 个受控子流程引用');
  await page.getByText('人事入职审批（副本）').click();
  await expect(page.getByTestId('flow-canvas')).toBeVisible();
  await expect(page.locator('.flow-node.subprocess').first()).toContainText('锁定 v1');
 });

 test('归档只挡新插入、不带走既有引用',async({page})=>{await page.goto('/workflows/wf-18');
  await page.getByTestId('canvas-node-s18-ref').click();
  await expect(page.getByTestId('bound-ref')).toContainText('供应商准入');
  await expect(page.getByTestId('bound-ref')).toContainText('源流程已归档');
  // 新加子流程节点时，已归档流程不可选
  await page.locator('.palette.subprocess').click();
  await page.locator('.flow-node.subprocess').first().click();
  const opts=await page.getByLabel('引用源流程').locator('option').allInnerTexts();
  expect(opts.some(t=>t.includes('供应商准入'))).toBeFalsy();
 });

 test('实例按插入版本运行并在监控中展示锁定版本',async({page})=>{await page.goto('/monitor');
  await page.getByRole('button',{name:'全部',exact:true}).click();
  await page.getByTestId('instance-row').filter({hasText:'INS-2026-0081'}).click();
  const locks=page.getByTestId('instance-locks');
  await expect(locks).toBeVisible();
  await expect(locks).toContainText('入职审批（标准）');
  await expect(locks).toContainText('v1');
 });
});

test('1440px 桌面视觉与控制台验证',async({page})=>{
 const errors:string[]=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const path of ['/','/workflows/wf-1','/monitor']){await page.goto(path);await page.waitForTimeout(250);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);expect(overflow,`${path} 不应横向溢出`).toBeFalsy()}
 await page.goto('/'); await page.screenshot({path:'test-results/dashboard-1440.png',fullPage:true});
 expect(errors,'浏览器 console 不应出现 error').toEqual([]);
});
