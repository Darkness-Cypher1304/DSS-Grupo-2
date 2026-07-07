// ============================================================================
// UsersController
// ============================================================================

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { CurrentUser, AuthUser, ClientIp, Roles, Public } from '../common/decorators';
import { constantTimeEqual } from '../common/security/constant-time';
import {
  UpdateProfileDto,
  UpdateUserStatusDto,
  RequestSpecialistUpgradeDto,
  VerifySpecialistDto,
  RequestAccountDeletionDto,
  RequestLeaveDto,
  LeaveDecisionDto,
} from './dto/users.dto';

@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  // --------------------------------------------------------------------------
  // GET /users/me — Perfil propio
  // --------------------------------------------------------------------------
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del usuario actual' })
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getMyProfile(user.sub);
  }

  // --------------------------------------------------------------------------
  // PATCH /users/me — Actualizar perfil propio
  // --------------------------------------------------------------------------
  @Patch('me')
  @ApiOperation({ summary: 'Actualizar perfil propio' })
  updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @ClientIp() ip: string,
  ) {
    return this.usersService.updateMyProfile(user.sub, dto, ip);
  }

  // --------------------------------------------------------------------------
  // POST /users/me/request-specialist
  // --------------------------------------------------------------------------
  @Post('me/request-specialist')
  @ApiOperation({ summary: 'Solicitar upgrade a Especialista' })
  requestSpecialistUpgrade(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestSpecialistUpgradeDto,
    @ClientIp() ip: string,
  ) {
    return this.usersService.requestSpecialistUpgrade(user.sub, dto, ip);
  }

  // ==========================================================================
  // ENDPOINTS ADMIN
  // ==========================================================================
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos los usuarios (admin)' })
  listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    return this.usersService.listUsers(page, Math.min(perPage, 100));
  }

  @Get('admin/specialists/pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar especialistas pendientes de verificación' })
  listPendingSpecialists() {
    return this.usersService.listPendingSpecialists();
  }

  @Patch('admin/specialists/:profileId/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprobar o rechazar especialista' })
  verifySpecialist(
    @Param('profileId') profileId: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: VerifySpecialistDto,
    @ClientIp() ip: string,
  ) {
    return this.usersService.verifySpecialist(profileId, admin.sub, dto, ip);
  }

  @Patch('admin/:userId/verify-email')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verificar y activar el correo de un usuario (admin)' })
  verifyUserEmail(
    @Param('userId') userId: string,
    @CurrentUser() admin: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.usersService.verifyUserEmail(userId, admin.sub, ip);
  }

  @Patch('admin/:userId/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cambiar status (suspender/activar)' })
  updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.usersService.updateUserStatus(userId, dto, admin.sub, ip);
  }

  // ==========================================================================
  // CICLO DE VIDA DE CUENTA (Etapa 3)
  // ==========================================================================

  // PADRE: eliminar mi cuenta (entra en período de gracia)
  @Post('me/request-deletion')
  @ApiOperation({ summary: 'Padre: solicitar eliminación de su cuenta (período de gracia)' })
  requestAccountDeletion(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestAccountDeletionDto,
    @ClientIp() ip: string,
  ) {
    return this.usersService.requestAccountDeletion(user.sub, dto, ip);
  }

  // PADRE: cancelar la eliminación durante la gracia
  @Post('me/cancel-deletion')
  @ApiOperation({ summary: 'Padre: cancelar la eliminación de su cuenta' })
  cancelAccountDeletion(@CurrentUser() user: AuthUser, @ClientIp() ip: string) {
    return this.usersService.cancelAccountDeletion(user.sub, ip);
  }

  // ESPECIALISTA: solicitar la baja
  @Post('me/request-leave')
  @ApiOperation({ summary: 'Especialista: solicitar la baja (revisa un admin)' })
  requestSpecialistLeave(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestLeaveDto,
    @ClientIp() ip: string,
  ) {
    return this.usersService.requestSpecialistLeave(user.sub, dto, ip);
  }

  // ADMIN: cola de solicitudes de baja
  @Get('admin/leave-requests')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar solicitudes de baja de especialistas (pendientes)' })
  listLeaveRequests() {
    return this.usersService.listLeaveRequests();
  }

  @Patch('admin/leave-requests/:id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprobar baja de especialista (→ cuenta INACTIVE)' })
  approveLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: LeaveDecisionDto,
    @ClientIp() ip: string,
  ) {
    return this.usersService.approveLeaveRequest(id, admin.sub, dto, ip);
  }

  @Patch('admin/leave-requests/:id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rechazar baja de especialista' })
  rejectLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: LeaveDecisionDto,
    @ClientIp() ip: string,
  ) {
    return this.usersService.rejectLeaveRequest(id, admin.sub, dto, ip);
  }

  // SISTEMA: procesar bajas vencidas (anonimización tras la gracia).
  // Público pero protegido por CRON_SECRET (lo invoca un GitHub Actions
  // programado, no un cron de Render). Si CRON_SECRET no está configurado, se
  // rechaza (inerte y seguro).
  @Public()
  @Post('system/process-deletions')
  @ApiOperation({ summary: 'Sistema: anonimizar cuentas cuyo período de gracia venció' })
  processExpiredDeletions(@Headers('x-cron-secret') secret?: string) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || !secret || !constantTimeEqual(secret, expected)) {
      throw new UnauthorizedException('No autorizado');
    }
    return this.usersService.processExpiredDeletions();
  }
}
