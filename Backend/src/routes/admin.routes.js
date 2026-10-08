import { Router } from 'express';
import * as controller from '../controllers/admin.controller.js';
import * as verification from '../controllers/verification.controller.js';
import * as adverts from '../controllers/advert.controller.js';
import { advertSchemas } from '../validators/advert.validators.js';
import * as engagement from '../controllers/engagement.controller.js';
import { engagementSchemas } from '../validators/engagement.validators.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { adminSchemas, verificationSchemas, itemSchemas, pagination } from '../validators/index.js';
import { USER_ROLE } from '../config/constants.js';

const router = Router();

// Every route below requires a staff role. There is no separate admin login,
// no shared password, and no client-side role check to bypass.
router.use(requireAuth, requireAdmin());

/* Dashboard */
router.get('/overview', controller.overview);
router.get('/timeseries', validate({ query: adminSchemas.timeseries }), controller.timeseries);
router.get('/analytics', controller.analytics);
router.get('/health', controller.health);

/* Verification review — the workflow missing from v1 */
router.get('/verifications', validate({ query: verificationSchemas.queue }), verification.queue);
router.get('/verifications/stats', verification.stats);
router.get('/verifications/:id', validate({ params: verificationSchemas.idParam }), verification.detail);
router.post('/verifications/:id/claim', validate({ params: verificationSchemas.idParam }), verification.claim);
router.post(
  '/verifications/:id/decision',
  validate({ params: verificationSchemas.idParam, body: verificationSchemas.decide }),
  verification.decide,
);
router.post(
  '/verifications/:id/resubmit',
  validate({ params: verificationSchemas.idParam, body: verificationSchemas.resubmit }),
  verification.requestResubmission,
);

/* Users */
router.get('/users', validate({ query: adminSchemas.listUsers }), controller.listUsers);
router.get('/users/:id', validate({ params: adminSchemas.idParam }), controller.userDetail);
router.patch('/users/:id/suspension', validate({ params: adminSchemas.idParam, body: adminSchemas.suspend }), controller.suspendUser);
router.patch(
  '/users/:id/role',
  requireAdmin(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validate({ params: adminSchemas.idParam, body: adminSchemas.setRole }),
  controller.setRole,
);
router.post('/users/invite', requireAdmin(USER_ROLE.SUPER_ADMIN), validate({ body: adminSchemas.invite }), controller.invite);
router.delete('/users/:id', requireAdmin(USER_ROLE.SUPER_ADMIN), validate({ params: adminSchemas.idParam }), controller.deleteUser);

/* Moderation */
router.get('/items', validate({ query: itemSchemas.browse }), controller.listItems);
router.patch('/items/:id/status', validate({ params: adminSchemas.idParam, body: adminSchemas.itemStatus }), controller.setItemStatus);
router.get('/payments', validate({ query: pagination }), controller.listPayments);

/* Engagement */
router.get('/engagement', validate({ query: engagementSchemas.overview }), engagement.adminOverview);
router.get('/engagement/comments', validate({ query: engagementSchemas.adminComments }), engagement.adminComments);
router.patch(
  '/engagement/comments/:commentId',
  validate({ params: engagementSchemas.commentId, body: engagementSchemas.hide }),
  engagement.adminHideComment,
);

/* Advertisements */
router.get('/adverts/stats', adverts.adminStats);
router.get('/adverts', validate({ query: advertSchemas.adminList }), adverts.adminList);
router.get('/adverts/:id', validate({ params: advertSchemas.idParam }), adverts.adminDetail);
router.patch(
  '/adverts/:id/status',
  validate({ params: advertSchemas.idParam, body: advertSchemas.adminStatus }),
  adverts.adminSetStatus,
);
router.get('/messages/recent', controller.recentMessages);

/* Tasks */
router.get('/tasks', validate({ query: pagination }), controller.listTasks);
router.post('/tasks', validate({ body: adminSchemas.createTask }), controller.createTask);
router.patch('/tasks/:id', validate({ params: adminSchemas.idParam, body: adminSchemas.updateTask }), controller.updateTask);
router.delete('/tasks/:id', validate({ params: adminSchemas.idParam }), controller.deleteTask);

/* Settings, feedback, audit */
router.get('/settings', controller.settings);
router.put('/settings', requireAdmin(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN), validate({ body: adminSchemas.setting }), controller.updateSetting);
router.get('/feedback', validate({ query: adminSchemas.feedback }), controller.listFeedback);
router.patch('/feedback/:id', validate({ params: adminSchemas.idParam }), controller.updateFeedback);
router.get('/audit-log', validate({ query: adminSchemas.auditLog }), controller.auditLog);

export default router;
