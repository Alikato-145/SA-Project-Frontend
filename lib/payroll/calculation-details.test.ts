import { expect, test } from "bun:test";
import { calculationDetail, groupPayrollMoney } from "./calculation-details";
import type { PayrollItem } from "./payroll-api";
const item = (description:string, extra:Partial<PayrollItem> = {}):PayrollItem => ({ item_type:'other', direction:'earning', description, quantity:null, rate:null, amount:'0.00', payroll_configuration_id:null, source_table:null, source_id:null, occurred_on:null, ...extra });
test('explains scheduled workday and overlapping holidays without money', () => {
 expect(calculationDetail(item('Workday calendar 2026-10-04; branch=5; working=false; reasons=weekly,public'), {'5':'สาขากรุงเทพ'})).toBe('วันหยุดประจำสัปดาห์, วันหยุดร้าน · สาขากรุงเทพ');
});
test('explains the automatic divisor and existing configuration values', () => {
 expect(calculationDetail(item('Automatic standard workdays',{quantity:'26.00'}), {})).toBe('จำนวนวันทำงานมาตรฐาน: 26 วัน');
 expect(calculationDetail(item('Configuration SOCIAL_SECURITY_RATE',{rate:'0.0500'}), {})).toBe('อัตราประกันสังคม: 5 %');
});
test('explains attendance and preserves unknown descriptions', () => {
 expect(calculationDetail(item('Attendance late; late_minutes=12; deductible=true'), {})).toBe('มาสาย 12 นาที · หักเงิน');
 expect(calculationDetail(item('Custom historical evidence'), {})).toBe('Custom historical evidence');
});

test('groups monetary rows by category and direction without losing satang', () => {
 const rows = [item('first', {item_type:'base_salary',amount:'769.23'}),item('second', {item_type:'base_salary',amount:'769.23'}),item('deduction', {item_type:'adjustment',direction:'deduction',amount:'0.01'}),item('bonus', {item_type:'adjustment',direction:'earning',amount:'0.02'})];
 const grouped = groupPayrollMoney(rows);
 expect(grouped.map(group => [group.itemType,group.direction,group.total,group.items.length])).toEqual([['base_salary','earning','1538.46',2],['adjustment','deduction','0.01',1],['adjustment','earning','0.02',1]]);
});
