import {test,expect} from '@playwright/test';
test.describe.serial('FlowDesk 完整链路',()=>{
 test('Dashboard KPI 与最近流程进入编辑器',async({page})=>{await page.goto('/');await expect(page.getByTestId('kpi-grid')).toBeVisible();await expect(page.getByText('流程总数')).toBeVisible();await expect(page.getByText('异常实例',{exact:true}).first()).toBeVisible();await page.getByTestId('recent-workflow').first().click();await expect(page.getByTestId('flow-canvas')).toBeVisible();});
 test('审批配置、保存和双区域校验',async({page})=>{await page.goto('/workflows/wf-1');await page.getByTestId('canvas-node-approval').click();await expect(page.getByTestId('config-panel')).toContainText('审批配置');await page.getByLabel('审批人来源').selectOption({label:'固定角色'});await page.getByTestId('save-node-config').click();await page.getByRole('button',{name:'保存草稿'}).click();await page.getByTestId('validate-button').click();await expect(page.getByTestId('canvas-node-condition')).toHaveClass(/invalid/);await expect(page.getByTestId('issues-panel')).toContainText('条件分支规则未配置');const before=await page.getByTestId('error-count').textContent();expect(Number(before?.match(/\d+/)?.[0])).toBeGreaterThan(0);await page.getByTestId('canvas-node-condition').click();await page.getByLabel('条件字段').selectOption('amount');await page.getByLabel('条件比较值').fill('5000');await page.getByTestId('save-node-config').click();await page.getByTestId('validate-button').click();await expect(page.getByTestId('error-count')).toContainText('0 错误');});
 test('表单预览金额驱动条件分支',async({page})=>{await page.goto('/workflows/wf-1/preview');await expect(page.getByTestId('branch-result')).toContainText('标准分支');await page.getByLabel('申请金额').fill('12000');await expect(page.getByTestId('branch-result')).toContainText('高额分支');});
 test('发布后列表和总览同步',async({page})=>{await page.goto('/workflows/wf-2');await page.getByTestId('publish-button').click();await expect(page.getByRole('status')).toContainText('发布成功');await page.getByRole('link',{name:'流程管理'}).click();const row=page.getByTestId('workflow-row').filter({hasText:'采购合同审批'});await expect(row).toContainText('已发布');await expect(row).toContainText('v3');await page.getByRole('link',{name:'总览'}).click();await expect(page.getByTestId('kpi-grid')).toBeVisible();});
 test('异常实例详情、时间线与当前节点高亮',async({page})=>{await page.goto('/monitor');await page.getByRole('button',{name:'异常',exact:true}).click();await page.getByTestId('instance-row').first().click();await expect(page.getByTestId('instance-detail')).toBeVisible();await expect(page.getByTestId('execution-timeline')).toContainText('提交申请');await expect(page.locator('.runtime-highlight')).toHaveCount(1);});
 test('受控子流程：列表显示锁定版本与待升级项',async({page})=>{
  await page.goto('/workflows');
  const row=page.getByTestId('workflow-row').filter({hasText:'采购合同审批'});
  await expect(row.getByTestId('refs-cell-wf-2')).toContainText('员工入职流程 v2');
  await expect(row.getByTestId('refs-cell-wf-2')).toContainText('1 项可升级');
  const blocked=page.getByTestId('workflow-row').filter({hasText:'年度预算调整'});
  await expect(blocked.getByTestId('refs-cell-wf-7')).toContainText('待处理');
 });

 test('受控子流程：插入时锁定已发布版本，归档源不能插入',async({page})=>{
  await page.goto('/workflows/wf-1');
  await page.getByTestId('palette-subflow').click();
  await expect(page.getByTestId('subflow-picker')).toBeVisible();
  await expect(page.getByTestId('pick-wf-6')).toHaveCount(0);
  await expect(page.getByTestId('pick-wf-13')).toHaveCount(0);
  await page.getByTestId('pick-wf-3').click();
  await expect(page.getByTestId('subflow-picker')).toHaveCount(0);
  await expect(page.getByTestId('subflow-config')).toBeVisible();
  await expect(page.getByTestId('subflow-config')).toContainText('v3');
  await expect(page.getByRole('status')).toContainText('锁定已发布版本 v3');
 });

 test('受控子流程：检查通过后确认升级，存量实例保持旧版本',async({page})=>{
  await page.goto('/workflows/wf-2');
  const banner=page.getByTestId('ref-row-subflow-onb');
  await expect(banner).toContainText('锁定 v2');
  await expect(banner).toContainText('最新 v3');
  await page.getByTestId('check-subflow-onb').click();
  await expect(banner).toContainText('已确认可升级 v3');
  await page.getByTestId('upgrade-subflow-onb').click();
  await expect(banner).toContainText('锁定 v3');
  await expect(page.getByRole('status')).toContainText('存量实例仍按 v2 运行');
  await expect(banner).toContainText('3 个实例继续按 v2 运行');
  await expect(banner).toContainText('已是最新');
 });

 test('受控子流程：接入点缺口未修复则留在待处理',async({page})=>{
  await page.goto('/workflows/wf-7');
  const node=page.locator('[data-node-type="subflow"]');
  await node.click();
  await page.getByTestId('config-check').click();
  await expect(page.getByTestId('config-gaps')).toContainText('接入点缺少下游连线');
  await expect(page.getByTestId('config-upgrade')).toHaveCount(0);
  await page.goto('/workflows/wf-7/versions');
  const hist=page.getByTestId('ref-history-subflow-onb');
  await expect(hist).toContainText('当前 v2');
  await expect(hist).toContainText('待处理：接入点缺少下游连线');
 });

 test('受控子流程：源缺结束节点时升级被挡，归档源引用保留',async({page})=>{
  await page.goto('/workflows/wf-9');
  await page.locator('[data-node-type="subflow"]').click();
  await page.getByTestId('config-check').click();
  await expect(page.getByTestId('config-gaps')).toContainText('目标版本 v2 缺少结束节点');
  await page.goto('/workflows/wf-5');
  const banner=page.getByTestId('ref-row-subflow-sup');
  await expect(banner).toContainText('源已归档');
  await page.goto('/workflows/wf-5/versions');
  await expect(page.getByTestId('ref-history-subflow-sup')).toContainText('源已归档，引用保留运行');
 });

 test('版本比较并恢复历史版本',async({page})=>{await page.goto('/workflows/wf-2/versions');await expect(page.getByTestId('version-compare')).toContainText('新增节点');await page.getByTestId('restore-version').click();await expect(page).toHaveURL(/\/workflows\/wf-2$/);await expect(page.getByRole('status')).toContainText('已恢复');await expect(page.getByTestId('flow-canvas')).toBeVisible();});
});

test('1440px 桌面视觉与控制台验证',async({page})=>{
 const errors:string[]=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const path of ['/','/workflows/wf-1','/monitor']){await page.goto(path);await page.waitForTimeout(250);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);expect(overflow,`${path} 不应横向溢出`).toBeFalsy()}
 await page.goto('/'); await page.screenshot({path:'test-results/dashboard-1440.png',fullPage:true});
 expect(errors,'浏览器 console 不应出现 error').toEqual([]);
});
