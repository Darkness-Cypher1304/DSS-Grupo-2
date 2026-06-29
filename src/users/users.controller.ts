// ============================================================================
// UsersController
// ============================================================================

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { CurrentUser, AuthUser, ClientIp, Roles } from '../common/decorators';
import {
  UpdateProfileDto,
  UpdateUserStatusDto,
  RequestSpecialistUpgradeDto,
  VerifySpecialistDto,
} from './dto/users.dto';

@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
