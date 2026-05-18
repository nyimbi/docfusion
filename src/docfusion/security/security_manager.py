#!/usr/bin/env python3
"""
Security Manager

Central security management system that integrates all security components
and provides a unified interface for authentication, authorization, encryption,
and audit logging across the entire application.
"""

import asyncio
from dataclasses import dataclass
import logging
import os
import secrets
from typing import Dict, List, Optional, Any

from .authentication.user_authentication import (
    UserAuthentication, UserCredentials, AuthenticationResult, SecurityConfiguration
)
from .authentication.api_authentication import (
    APIAuthentication, APIAuthenticationConfig, APIKeyResult
)
from .authentication.oauth_authentication import (
    OAuthAuthentication, OAuthConfiguration, OAuthResult, OAuthProvider
)
from .authentication.saml_authentication import (
    SAMLAuthentication, SAMLConfiguration, SAMLResult
)
from .authentication.webauthn_authentication import (
    WebAuthnAuthentication, WebAuthnConfiguration, WebAuthnResult
)
from .authentication.device_management import (
    DeviceManager, DeviceManagementConfig, DeviceFingerprint, DeviceType, TrustLevel
)
from .authorization.role_based_access import (
    RoleBasedAccess, RBACConfiguration, PermissionAction, ResourceType, AccessResult
)
from .authorization.document_permissions import (
    DocumentPermissions, DocumentPermissionsConfig, PermissionLevel
)
from .authorization.abac_authorization import (
    ABACAuthorization, ABACConfiguration
)
from .authorization.contextual_access import (
    ContextualAccessControl, ContextualAccessConfig, AccessContext, AccessDecision
)
from .encryption.data_encryption import (
    DataEncryption, EncryptionConfiguration, EncryptionResult, KeyType
)
from .encryption.e2e_encryption import (
    E2EEncryption, E2EEncryptionConfig
)
from .compliance.gdpr_compliance import (
    GDPRCompliance, GDPRConfiguration
)
from .compliance.compliance_dashboard import (
    ComplianceDashboard, DashboardConfiguration
)
from .data_protection.dlp_system import (
    DLPSystem, DLPConfiguration, ContentType, DLPAction
)
from .audit.audit_logger import (
    AuditLogger, AuditConfiguration, AuditEventType, AuditSeverity,
    log_authentication_event, log_document_event, log_security_event
)


@dataclass
class SecurityManagerConfiguration:
    """Configuration for the security manager"""
    # Component configurations
    auth_config: Optional[SecurityConfiguration] = None
    api_auth_config: Optional[APIAuthenticationConfig] = None
    oauth_config: Optional[OAuthConfiguration] = None
    saml_config: Optional[SAMLConfiguration] = None
    webauthn_config: Optional[WebAuthnConfiguration] = None
    device_mgmt_config: Optional[DeviceManagementConfig] = None
    rbac_config: Optional[RBACConfiguration] = None
    abac_config: Optional[ABACConfiguration] = None
    contextual_access_config: Optional[ContextualAccessConfig] = None
    doc_permissions_config: Optional[DocumentPermissionsConfig] = None
    encryption_config: Optional[EncryptionConfiguration] = None
    e2e_encryption_config: Optional[E2EEncryptionConfig] = None
    gdpr_config: Optional[GDPRConfiguration] = None
    dashboard_config: Optional[DashboardConfiguration] = None
    dlp_config: Optional[DLPConfiguration] = None
    audit_config: Optional[AuditConfiguration] = None
    
    # Integration settings
    enable_audit_integration: bool = True
    enable_encryption_integration: bool = True
    enable_oauth_integration: bool = True
    enable_saml_integration: bool = True
    enable_webauthn_integration: bool = True
    enable_device_management: bool = True
    enable_abac_integration: bool = True
    enable_contextual_access: bool = True
    enable_e2e_encryption: bool = True
    enable_gdpr_compliance: bool = True
    enable_compliance_dashboard: bool = True
    enable_dlp_system: bool = True
    
    auto_create_system_user: bool = True
    system_user_id: str = "system"
    
    # Security policies
    require_mfa_for_admin: bool = True
    session_timeout_minutes: int = 60
    password_policy_strict: bool = True
    enable_advanced_security_features: bool = True


class SecurityManager:
    """Central security management system"""
    
    def __init__(self, config: Optional[SecurityManagerConfiguration] = None):
        """Initialize security manager with all components"""
        self.config = config or SecurityManagerConfiguration()
        self.logger = logging.getLogger(__name__)
        
        # Initialize core security components
        self.user_auth = UserAuthentication(self.config.auth_config)
        self.api_auth = APIAuthentication(self.config.api_auth_config)
        self.rbac = RoleBasedAccess(self.config.rbac_config)
        self.doc_permissions = DocumentPermissions(self.config.doc_permissions_config)
        self.encryption = DataEncryption(self.config.encryption_config)
        self.audit = AuditLogger(self.config.audit_config)
        
        # Initialize enhanced security components
        self.oauth_auth = None
        if self.config.enable_oauth_integration:
            try:
                self.oauth_auth = OAuthAuthentication(self.config.oauth_config)
            except Exception as e:
                self.logger.warning(f"OAuth authentication disabled: {e}")
        
        self.saml_auth = None
        if self.config.enable_saml_integration:
            try:
                if self.config.saml_config:
                    self.saml_auth = SAMLAuthentication(self.config.saml_config)
            except Exception as e:
                self.logger.warning(f"SAML authentication disabled: {e}")
        
        self.abac = None
        if self.config.enable_abac_integration:
            try:
                self.abac = ABACAuthorization(self.config.abac_config)
            except Exception as e:
                self.logger.warning(f"ABAC authorization disabled: {e}")
        
        self.contextual_access = None
        if self.config.enable_contextual_access:
            try:
                self.contextual_access = ContextualAccessControl(self.config.contextual_access_config)
            except Exception as e:
                self.logger.warning(f"Contextual access control disabled: {e}")
        
        self.e2e_encryption = None
        if self.config.enable_e2e_encryption:
            try:
                self.e2e_encryption = E2EEncryption(self.config.e2e_encryption_config)
            except Exception as e:
                self.logger.warning(f"E2E encryption disabled: {e}")
        
        self.gdpr_compliance = None
        if self.config.enable_gdpr_compliance:
            try:
                self.gdpr_compliance = GDPRCompliance(self.config.gdpr_config)
            except Exception as e:
                self.logger.warning(f"GDPR compliance disabled: {e}")
        
        self.compliance_dashboard = None
        if self.config.enable_compliance_dashboard:
            try:
                self.compliance_dashboard = ComplianceDashboard(self.config.dashboard_config)
            except Exception as e:
                self.logger.warning(f"Compliance dashboard disabled: {e}")
        
        self.webauthn_auth = None
        if self.config.enable_webauthn_integration:
            try:
                self.webauthn_auth = WebAuthnAuthentication(self.config.webauthn_config)
            except Exception as e:
                self.logger.warning(f"WebAuthn authentication disabled: {e}")
        
        self.device_manager = None
        if self.config.enable_device_management:
            try:
                self.device_manager = DeviceManager(self.config.device_mgmt_config)
            except Exception as e:
                self.logger.warning(f"Device management disabled: {e}")
        
        self.dlp_system = None
        if self.config.enable_dlp_system:
            try:
                self.dlp_system = DLPSystem(self.config.dlp_config)
            except Exception as e:
                self.logger.warning(f"DLP system disabled: {e}")
        
        # Component integration flags
        self.initialized = False
        
        # Initialize system
        asyncio.create_task(self._initialize_system())
        
        self.logger.info("Enhanced security manager initialized with advanced features")
    
    # ==================== AUTHENTICATION METHODS ====================
    
    async def authenticate_user(
        self,
        username: str,
        password: str,
        mfa_code: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuthenticationResult:
        """Authenticate user with comprehensive security checks"""
        credentials = UserCredentials(
            username=username,
            password=password,
            mfa_code=mfa_code,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        result = await self.user_auth.authenticate(credentials)
        
        # Log authentication event
        if self.config.enable_audit_integration:
            event_type = AuditEventType.LOGIN_SUCCESS if result.status.value == "success" else AuditEventType.LOGIN_FAILED
            await log_authentication_event(
                self.audit,
                event_type,
                username,
                result.status.value == "success",
                ip_address,
                user_agent,
                {'status': result.status.value, 'requires_mfa': result.requires_mfa}
            )
        
        return result
    
    # ==================== ENHANCED AUTHENTICATION METHODS ====================
    
    async def get_oauth_login_url(
        self,
        provider: OAuthProvider,
        redirect_uri: str,
        user_id: Optional[str] = None,
        client_ip: Optional[str] = None
    ) -> Optional[str]:
        """Get OAuth login URL for provider"""
        if not self.oauth_auth:
            return None
        
        try:
            return self.oauth_auth.get_authorization_url(
                provider=provider,
                redirect_uri=redirect_uri,
                user_id=user_id,
                client_ip=client_ip
            )
        except Exception as e:
            self.logger.error(f"OAuth URL generation failed: {e}")
            return None
    
    async def handle_oauth_callback(
        self,
        provider: OAuthProvider,
        code: str,
        state: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[OAuthResult]:
        """Handle OAuth authentication callback"""
        if not self.oauth_auth:
            return None
        
        result = await self.oauth_auth.handle_authorization_callback(
            provider=provider,
            code=code,
            state=state,
            client_ip=client_ip,
            user_agent=user_agent
        )
        
        # Log OAuth authentication
        if self.config.enable_audit_integration and result:
            event_type = AuditEventType.LOGIN_SUCCESS if result.success else AuditEventType.LOGIN_FAILED
            await self.audit.log_event(
                event_type=event_type,
                action="oauth_callback",
                description=f"OAuth {provider.value} authentication: {result.success}",
                source_ip=client_ip,
                user_agent=user_agent,
                severity=AuditSeverity.MEDIUM,
                details={
                    'provider': provider.value,
                    'success': result.success,
                    'error': result.error
                }
            )
        
        return result
    
    async def get_saml_sso_url(
        self,
        idp_entity_id: str,
        relay_state: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Optional[str]:
        """Get SAML SSO URL for identity provider"""
        if not self.saml_auth:
            return None
        
        try:
            return self.saml_auth.get_sso_url(
                idp_entity_id=idp_entity_id,
                relay_state=relay_state,
                user_id=user_id
            )
        except Exception as e:
            self.logger.error(f"SAML SSO URL generation failed: {e}")
            return None
    
    async def handle_saml_response(
        self,
        saml_response: str,
        relay_state: Optional[str] = None
    ) -> Optional[SAMLResult]:
        """Handle SAML authentication response"""
        if not self.saml_auth:
            return None
        
        result = await self.saml_auth.handle_sso_response(
            saml_response=saml_response,
            relay_state=relay_state
        )
        
        # Log SAML authentication
        if self.config.enable_audit_integration and result:
            event_type = AuditEventType.LOGIN_SUCCESS if result.success else AuditEventType.LOGIN_FAILED
            await self.audit.log_event(
                event_type=event_type,
                action="saml_response",
                description=f"SAML authentication: {result.success}",
                severity=AuditSeverity.MEDIUM,
                details={
                    'success': result.success,
                    'error': result.error,
                    'user_email': result.user_info.email if result.user_info else None
                }
            )
        
        return result
    
    # ==================== WEBAUTHN METHODS ====================
    
    async def begin_webauthn_registration(
        self,
        user_id: str,
        username: str,
        display_name: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Begin WebAuthn credential registration"""
        if not self.webauthn_auth:
            return None
        
        try:
            result = await self.webauthn_auth.begin_registration(
                user_id=user_id,
                username=username,
                display_name=display_name,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            # Log WebAuthn registration start
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="webauthn_registration_start",
                    description=f"WebAuthn registration started for user {username}",
                    user_id=user_id,
                    source_ip=ip_address,
                    user_agent=user_agent,
                    severity=AuditSeverity.LOW
                )
            
            return result
        
        except Exception as e:
            self.logger.error(f"WebAuthn registration initiation failed: {e}")
            return None
    
    async def complete_webauthn_registration(
        self,
        challenge_id: str,
        credential_data: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[WebAuthnResult]:
        """Complete WebAuthn credential registration"""
        if not self.webauthn_auth:
            return None
        
        result = await self.webauthn_auth.complete_registration(
            challenge_id=challenge_id,
            credential_data=credential_data,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Log WebAuthn registration completion
        if self.config.enable_audit_integration and result:
            event_type = AuditEventType.SYSTEM_START if result.success else AuditEventType.SYSTEM_ERROR
            await self.audit.log_event(
                event_type=event_type,
                action="webauthn_registration_complete",
                description=f"WebAuthn registration: {result.success}",
                user_id=result.user_id,
                source_ip=ip_address,
                user_agent=user_agent,
                severity=AuditSeverity.MEDIUM if result.success else AuditSeverity.HIGH,
                details={
                    'success': result.success,
                    'credential_id': result.credential_id,
                    'error': result.error
                }
            )
        
        return result
    
    async def begin_webauthn_authentication(
        self,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Begin WebAuthn authentication"""
        if not self.webauthn_auth:
            return None
        
        try:
            return await self.webauthn_auth.begin_authentication(
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent
            )
        
        except Exception as e:
            self.logger.error(f"WebAuthn authentication initiation failed: {e}")
            return None
    
    async def complete_webauthn_authentication(
        self,
        challenge_id: str,
        assertion_data: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[WebAuthnResult]:
        """Complete WebAuthn authentication"""
        if not self.webauthn_auth:
            return None
        
        result = await self.webauthn_auth.complete_authentication(
            challenge_id=challenge_id,
            assertion_data=assertion_data,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Log WebAuthn authentication
        if self.config.enable_audit_integration and result:
            event_type = AuditEventType.LOGIN_SUCCESS if result.success else AuditEventType.LOGIN_FAILED
            await self.audit.log_event(
                event_type=event_type,
                action="webauthn_authentication",
                description=f"WebAuthn authentication: {result.success}",
                user_id=result.user_id,
                source_ip=ip_address,
                user_agent=user_agent,
                severity=AuditSeverity.LOW if result.success else AuditSeverity.MEDIUM,
                details={
                    'success': result.success,
                    'credential_id': result.credential_id,
                    'user_verified': result.user_verified,
                    'error': result.error
                }
            )
        
        return result
    
    # ==================== DEVICE MANAGEMENT METHODS ====================
    
    async def register_user_device(
        self,
        user_id: str,
        device_name: str,
        device_type: str,
        device_fingerprint_data: Dict[str, Any],
        webauthn_credential_id: Optional[str] = None,
        security_features: Optional[Dict[str, bool]] = None
    ) -> Optional[str]:
        """Register a new device for user"""
        if not self.device_manager:
            return None
        
        try:
            # Convert device type string to enum
            device_type_enum = DeviceType(device_type)
            
            # Create device fingerprint
            fingerprint = DeviceFingerprint(**device_fingerprint_data)
            
            device_id = await self.device_manager.register_device(
                user_id=user_id,
                device_name=device_name,
                device_type=device_type_enum,
                device_fingerprint=fingerprint,
                webauthn_credential_id=webauthn_credential_id,
                security_features=security_features
            )
            
            # Log device registration
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="device_registered",
                    description=f"Device registered: {device_name}",
                    user_id=user_id,
                    source_ip=fingerprint.ip_address,
                    severity=AuditSeverity.MEDIUM,
                    details={
                        'device_id': device_id,
                        'device_type': device_type,
                        'has_webauthn': webauthn_credential_id is not None
                    }
                )
            
            return device_id
        
        except Exception as e:
            self.logger.error(f"Device registration failed: {e}")
            return None
    
    async def verify_user_device(
        self,
        user_id: str,
        device_fingerprint_data: Dict[str, Any],
        webauthn_credential_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Verify device for user authentication"""
        if not self.device_manager:
            return {
                'verified': False,
                'reason': 'Device management not available'
            }
        
        try:
            # Create device fingerprint
            fingerprint = DeviceFingerprint(**device_fingerprint_data)
            
            result = await self.device_manager.verify_device(
                user_id=user_id,
                device_fingerprint=fingerprint,
                webauthn_credential_id=webauthn_credential_id
            )
            
            # Log device verification
            if self.config.enable_audit_integration:
                event_type = AuditEventType.ACCESS_GRANTED if result.get('verified') else AuditEventType.ACCESS_DENIED
                await self.audit.log_event(
                    event_type=event_type,
                    action="device_verification",
                    description=f"Device verification: {result.get('verified', False)}",
                    user_id=user_id,
                    source_ip=fingerprint.ip_address,
                    severity=AuditSeverity.LOW if result.get('verified') else AuditSeverity.MEDIUM,
                    details={
                        'device_id': result.get('device_id'),
                        'trust_level': result.get('trust_level'),
                        'reason': result.get('reason'),
                        'security_warnings': result.get('security_warnings', [])
                    }
                )
            
            return result
        
        except Exception as e:
            self.logger.error(f"Device verification failed: {e}")
            return {
                'verified': False,
                'reason': f'Verification error: {str(e)}'
            }
    
    async def trust_user_device(
        self,
        device_id: str,
        trust_level: str,
        trusted_by: str,
        trust_duration_days: Optional[int] = None
    ) -> bool:
        """Establish trust for a user device"""
        if not self.device_manager:
            return False
        
        try:
            trust_level_enum = TrustLevel(trust_level)
            result = await self.device_manager.trust_device(
                device_id=device_id,
                trust_level=trust_level_enum,
                trusted_by=trusted_by,
                trust_duration_days=trust_duration_days
            )
            
            # Log device trust establishment
            if self.config.enable_audit_integration and result:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="device_trusted",
                    description=f"Device trust established at {trust_level} level",
                    user_id=trusted_by,
                    severity=AuditSeverity.MEDIUM,
                    details={
                        'device_id': device_id,
                        'trust_level': trust_level,
                        'trust_duration_days': trust_duration_days
                    }
                )
            
            return result
        
        except Exception as e:
            self.logger.error(f"Device trust establishment failed: {e}")
            return False
    
    async def get_user_devices(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all devices for a user"""
        if not self.device_manager:
            return []
        
        return await self.device_manager.get_user_devices(user_id)
    
    async def revoke_device_trust(
        self,
        device_id: str,
        revoked_by: str,
        reason: str = "Trust revoked by administrator"
    ) -> bool:
        """Revoke trust for a device"""
        if not self.device_manager:
            return False
        
        return await self.device_manager.revoke_device_trust(
            device_id=device_id,
            revoked_by=revoked_by,
            reason=reason
        )
    
    async def block_user_device(
        self,
        device_id: str,
        blocked_by: str,
        reason: str = "Device blocked by administrator"
    ) -> bool:
        """Block a user device"""
        if not self.device_manager:
            return False
        
        return await self.device_manager.block_device(
            device_id=device_id,
            blocked_by=blocked_by,
            reason=reason
        )
    
    # ==================== CONTEXTUAL ACCESS CONTROL METHODS ====================
    
    async def evaluate_contextual_access(
        self,
        user_id: str,
        action: str,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        geolocation: Optional[Dict[str, Any]] = None,
        device_id: Optional[str] = None,
        device_trust_level: Optional[str] = None,
        authentication_method: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[AccessDecision]:
        """Evaluate access request with contextual factors"""
        if not self.contextual_access:
            return None
        
        try:
            # Create access context
            context = AccessContext(
                user_id=user_id,
                resource_id=resource_id,
                action=action,
                ip_address=ip_address,
                geolocation=geolocation,
                device_id=device_id,
                device_trust_level=device_trust_level,
                authentication_method=authentication_method
            )
            
            # Evaluate access
            decision = await self.contextual_access.evaluate_access(context)
            
            # Log contextual access decision
            if self.config.enable_audit_integration:
                event_type = AuditEventType.ACCESS_GRANTED if decision.decision == "allow" else AuditEventType.ACCESS_DENIED
                await self.audit.log_event(
                    event_type=event_type,
                    action="contextual_access_evaluation",
                    description=f"Contextual access decision: {decision.decision}",
                    user_id=user_id,
                    resource_type=resource_id,
                    source_ip=ip_address,
                    user_agent=user_agent,
                    severity=AuditSeverity.LOW if decision.decision == "allow" else AuditSeverity.MEDIUM,
                    details={
                        'decision': decision.decision,
                        'risk_score': decision.overall_risk_score,
                        'policy_matches': len(decision.policy_matches),
                        'constraint_violations': len(decision.constraint_violations),
                        'additional_auth_required': decision.additional_auth_required,
                        'decision_reason': decision.decision_reason
                    }
                )
            
            return decision
        
        except Exception as e:
            self.logger.error(f"Contextual access evaluation failed: {e}")
            # Return deny decision on error
            return AccessDecision(
                decision="deny",
                user_id=user_id,
                resource_id=resource_id,
                action=action,
                decision_reason=f"Evaluation error: {str(e)}"
            )
    
    async def create_time_constraint(
        self,
        name: str,
        pattern: str,
        created_by: str,
        **kwargs
    ) -> Optional[str]:
        """Create time-based access constraint"""
        if not self.contextual_access:
            return None
        
        try:
            from .authorization.contextual_access import AccessTimePattern
            pattern_enum = AccessTimePattern(pattern)
            
            constraint_id = self.contextual_access.create_time_constraint(
                name=name,
                pattern=pattern_enum,
                created_by=created_by,
                **kwargs
            )
            
            # Log constraint creation
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="time_constraint_created",
                    description=f"Time constraint created: {name}",
                    user_id=created_by,
                    severity=AuditSeverity.LOW,
                    details={'constraint_id': constraint_id, 'pattern': pattern}
                )
            
            return constraint_id
        
        except Exception as e:
            self.logger.error(f"Time constraint creation failed: {e}")
            return None
    
    async def create_location_constraint(
        self,
        name: str,
        scope: str,
        created_by: str,
        **kwargs
    ) -> Optional[str]:
        """Create location-based access constraint"""
        if not self.contextual_access:
            return None
        
        try:
            from .authorization.contextual_access import LocationScope
            scope_enum = LocationScope(scope)
            
            constraint_id = self.contextual_access.create_location_constraint(
                name=name,
                scope=scope_enum,
                created_by=created_by,
                **kwargs
            )
            
            # Log constraint creation
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="location_constraint_created",
                    description=f"Location constraint created: {name}",
                    user_id=created_by,
                    severity=AuditSeverity.LOW,
                    details={'constraint_id': constraint_id, 'scope': scope}
                )
            
            return constraint_id
        
        except Exception as e:
            self.logger.error(f"Location constraint creation failed: {e}")
            return None
    
    async def create_contextual_policy(
        self,
        policy_name: str,
        description: str,
        created_by: str,
        **kwargs
    ) -> Optional[str]:
        """Create contextual access control policy"""
        if not self.contextual_access:
            return None
        
        try:
            policy_id = self.contextual_access.create_contextual_policy(
                policy_name=policy_name,
                description=description,
                created_by=created_by,
                **kwargs
            )
            
            # Log policy creation
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="contextual_policy_created",
                    description=f"Contextual policy created: {policy_name}",
                    user_id=created_by,
                    severity=AuditSeverity.MEDIUM,
                    details={'policy_id': policy_id}
                )
            
            return policy_id
        
        except Exception as e:
            self.logger.error(f"Contextual policy creation failed: {e}")
            return None
    
    async def get_user_risk_assessment(
        self,
        user_id: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get risk assessment summary for user"""
        if not self.contextual_access:
            return {
                'user_id': user_id,
                'error': 'Contextual access control not available'
            }
        
        return await self.contextual_access.get_risk_assessment_summary(user_id, hours)
    
    # ==================== DATA LOSS PREVENTION METHODS ====================
    
    async def scan_content_for_dlp(
        self,
        content: str,
        content_type: str,
        user_id: str,
        resource_id: Optional[str] = None,
        action: str = "access",
        source_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scan content for sensitive data and enforce DLP policies"""
        if not self.dlp_system:
            return {
                'allowed': True,
                'action_taken': 'allow',
                'error': 'DLP system not available'
            }
        
        try:
            # Convert content type string to enum
            content_type_enum = ContentType(content_type)
            
            # Perform DLP scan and enforcement
            result = await self.dlp_system.scan_and_enforce(
                content=content,
                content_type=content_type_enum,
                user_id=user_id,
                resource_id=resource_id,
                action=action,
                source_ip=source_ip
            )
            
            # Log DLP enforcement action
            if self.config.enable_audit_integration:
                event_type = AuditEventType.ACCESS_GRANTED if result['allowed'] else AuditEventType.ACCESS_DENIED
                await self.audit.log_event(
                    event_type=event_type,
                    action="dlp_content_scan",
                    description=f"DLP scan result: {result['action_taken']}",
                    user_id=user_id,
                    resource_type=resource_id,
                    source_ip=source_ip,
                    user_agent=user_agent,
                    severity=AuditSeverity.LOW if result['allowed'] else AuditSeverity.HIGH,
                    details={
                        'content_type': content_type,
                        'action': action,
                        'dlp_action_taken': result['action_taken'],
                        'patterns_found': result.get('scan_result', {}).get('patterns_found', 0),
                        'confidence': result.get('scan_result', {}).get('confidence', 0.0),
                        'violations': len(result.get('violations', []))
                    }
                )
            
            return result
        
        except Exception as e:
            self.logger.error(f"DLP content scanning failed: {e}")
            # Fail secure - block on error
            return {
                'allowed': False,
                'action_taken': DLPAction.BLOCK,
                'error': str(e),
                'blocked_reasons': ['DLP system error']
            }
    
    async def create_dlp_data_pattern(
        self,
        name: str,
        description: str,
        pattern_type: str,
        created_by: str,
        **kwargs
    ) -> Optional[str]:
        """Create DLP data pattern"""
        if not self.dlp_system:
            return None
        
        try:
            pattern_id = self.dlp_system.create_data_pattern(
                name=name,
                description=description,
                pattern_type=pattern_type,
                created_by=created_by,
                **kwargs
            )
            
            # Log pattern creation
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="dlp_pattern_created",
                    description=f"DLP pattern created: {name}",
                    user_id=created_by,
                    severity=AuditSeverity.LOW,
                    details={'pattern_id': pattern_id, 'pattern_type': pattern_type}
                )
            
            return pattern_id
        
        except Exception as e:
            self.logger.error(f"DLP pattern creation failed: {e}")
            return None
    
    async def create_dlp_rule(
        self,
        rule_name: str,
        description: str,
        created_by: str,
        **kwargs
    ) -> Optional[str]:
        """Create DLP policy rule"""
        if not self.dlp_system:
            return None
        
        try:
            rule_id = self.dlp_system.create_dlp_rule(
                rule_name=rule_name,
                description=description,
                created_by=created_by,
                **kwargs
            )
            
            # Log rule creation
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,
                    action="dlp_rule_created",
                    description=f"DLP rule created: {rule_name}",
                    user_id=created_by,
                    severity=AuditSeverity.MEDIUM,
                    details={'rule_id': rule_id}
                )
            
            return rule_id
        
        except Exception as e:
            self.logger.error(f"DLP rule creation failed: {e}")
            return None
    
    async def queue_dlp_background_scan(
        self,
        content: str,
        content_type: str,
        user_id: str,
        content_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None
    ) -> bool:
        """Queue content for background DLP scanning"""
        if not self.dlp_system:
            return False
        
        try:
            content_type_enum = ContentType(content_type)
            return await self.dlp_system.queue_background_scan(
                content=content,
                content_type=content_type_enum,
                user_id=user_id,
                content_id=content_id,
                resource_id=resource_id,
                action=action
            )
        
        except Exception as e:
            self.logger.error(f"DLP background scan queueing failed: {e}")
            return False
    
    async def get_dlp_violation_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get DLP violation summary"""
        if not self.dlp_system:
            return {
                'error': 'DLP system not available'
            }
        
        return self.dlp_system.get_violation_summary(hours)
    
    async def get_user_dlp_violations(self, user_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get DLP violations for specific user"""
        if not self.dlp_system:
            return []
        
        return self.dlp_system.get_user_violations(user_id, days)
    
    async def create_user_account(
        self,
        username: str,
        password: str,
        email: Optional[str] = None,
        created_by: str = "system",
        initial_roles: Optional[List[str]] = None,
        require_mfa: bool = False
    ) -> Dict[str, Any]:
        """Create user account with initial roles and permissions"""
        try:
            # Create user authentication record
            user_id = await self.user_auth.create_user(username, password, email, require_mfa)
            
            # Assign initial roles
            if initial_roles:
                for role_name in initial_roles:
                    # Find role by name (simplified lookup)
                    role_id = await self._find_role_by_name(role_name)
                    if role_id:
                        await self.rbac.assign_role_to_user(user_id, role_id, created_by)
            
            # Log user creation
            if self.config.enable_audit_integration:
                await self.audit.log_event(
                    event_type=AuditEventType.SYSTEM_START,  # No specific user creation event
                    action="create_user",
                    description=f"Created user account: {username}",
                    user_id=created_by,
                    resource_type="user",
                    resource_id=user_id,
                    severity=AuditSeverity.MEDIUM,
                    details={'username': username, 'initial_roles': initial_roles or []}
                )
            
            return {
                'success': True,
                'user_id': user_id,
                'username': username,
                'roles_assigned': len(initial_roles or [])
            }
        
        except Exception as e:
            self.logger.error(f"Failed to create user account: {e}")
            return {'success': False, 'error': str(e)}
    
    async def authenticate_api_request(
        self,
        api_key: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None
    ) -> APIKeyResult:
        """Authenticate API request"""
        result = await self.api_auth.authenticate_api_key(
            api_key, ip_address, user_agent, endpoint, method
        )
        
        # Log API authentication
        if self.config.enable_audit_integration:
            await self.audit.log_event(
                event_type=AuditEventType.API_CALL,
                action="api_authenticate",
                description=f"API authentication: {result.success}",
                source_ip=ip_address,
                user_agent=user_agent,
                severity=AuditSeverity.LOW,
                details={
                    'endpoint': endpoint,
                    'method': method,
                    'success': result.success,
                    'rate_limited': result.rate_limited
                }
            )
        
        return result
    
    # ==================== AUTHORIZATION METHODS ====================
    
    async def check_permission(
        self,
        user_id: str,
        resource_type: str,
        action: str,
        resource_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> AccessResult:
        """Check user permission for resource action"""
        try:
            # Convert string enums
            resource_type_enum = ResourceType(resource_type)
            action_enum = PermissionAction(action)
        except ValueError as e:
            return AccessResult(
                decision="denied",
                user_id=user_id,
                resource_type=resource_type_enum if 'resource_type_enum' in locals() else ResourceType.SYSTEM,
                action=action_enum if 'action_enum' in locals() else PermissionAction.READ,
                reason=f"Invalid resource type or action: {e}"
            )
        
        result = await self.rbac.check_permission(
            user_id, resource_type_enum, action_enum, resource_id, context
        )
        
        # Log authorization check
        if self.config.enable_audit_integration:
            event_type = AuditEventType.ACCESS_GRANTED if result.decision.value == "granted" else AuditEventType.ACCESS_DENIED
            await self.audit.log_event(
                event_type=event_type,
                action=f"check_permission_{action}",
                description=f"Permission check: {result.decision.value}",
                user_id=user_id,
                resource_type=resource_type,
                resource_id=resource_id,
                severity=AuditSeverity.LOW if result.decision.value == "granted" else AuditSeverity.MEDIUM,
                details={'reason': result.reason}
            )
        
        return result
    
    async def check_document_permission(
        self,
        document_id: str,
        user_id: str,
        permission_level: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Check document-specific permission"""
        try:
            permission_level_enum = PermissionLevel(permission_level)
        except ValueError:
            return {
                'has_permission': False,
                'error': f"Invalid permission level: {permission_level}"
            }
        
        result = await self.doc_permissions.check_document_permission(
            document_id, user_id, permission_level_enum, context
        )
        
        # Log document access check
        if self.config.enable_audit_integration:
            event_type = AuditEventType.ACCESS_GRANTED if result['has_permission'] else AuditEventType.ACCESS_DENIED
            await self.audit.log_event(
                event_type=event_type,
                action=f"check_document_permission",
                description=f"Document permission check: {result['has_permission']}",
                user_id=user_id,
                resource_type="document",
                resource_id=document_id,
                severity=AuditSeverity.LOW,
                details={'permission_level': permission_level}
            )
        
        return result
    
    # ==================== DOCUMENT SECURITY METHODS ====================
    
    async def grant_document_access(
        self,
        document_id: str,
        user_id: str,
        granted_by: str,
        permission_level: str,
        expires_in_days: Optional[int] = None,
        can_share: bool = False
    ) -> str:
        """Grant document access to user"""
        try:
            permission_level_enum = PermissionLevel(permission_level)
        except ValueError:
            raise ValueError(f"Invalid permission level: {permission_level}")
        
        access_id = await self.doc_permissions.grant_document_access(
            document_id=document_id,
            granted_by=granted_by,
            permission_level=permission_level_enum,
            user_id=user_id,
            expires_in_days=expires_in_days,
            can_share=can_share
        )
        
        # Log document access grant
        if self.config.enable_audit_integration:
            await log_document_event(
                self.audit,
                AuditEventType.DOCUMENT_SHARED,
                "grant_access",
                document_id,
                granted_by,
                details={
                    'target_user_id': user_id,
                    'permission_level': permission_level,
                    'expires_in_days': expires_in_days,
                    'can_share': can_share
                }
            )
        
        return access_id
    
    async def create_document_share_link(
        self,
        document_id: str,
        created_by: str,
        permission_level: str = "view",
        expires_in_days: Optional[int] = None,
        password: Optional[str] = None
    ) -> str:
        """Create shareable link for document"""
        try:
            permission_level_enum = PermissionLevel(permission_level)
        except ValueError:
            raise ValueError(f"Invalid permission level: {permission_level}")
        
        share_link = await self.doc_permissions.create_share_link(
            document_id=document_id,
            created_by=created_by,
            permission_level=permission_level_enum,
            expires_in_days=expires_in_days,
            password=password
        )
        
        return share_link
    
    # ==================== ENCRYPTION METHODS ====================
    
    async def encrypt_sensitive_data(
        self,
        data: str,
        purpose: str,
        user_id: str
    ) -> EncryptionResult:
        """Encrypt sensitive data with automatic key management"""
        # Create or get encryption key for this purpose
        key_id = await self.encryption.create_encryption_key(
            key_type=KeyType.DATA,
            purpose=purpose,
            created_by=user_id
        )
        
        result = await self.encryption.encrypt_data(data, key_id)
        
        # Log encryption event
        if self.config.enable_audit_integration:
            await self.audit.log_event(
                event_type=AuditEventType.DATA_ENCRYPTED,
                action="encrypt_data",
                description=f"Encrypted data for: {purpose}",
                user_id=user_id,
                severity=AuditSeverity.LOW,
                details={
                    'purpose': purpose,
                    'key_id': key_id,
                    'success': result.success,
                    'data_size': result.data_size
                }
            )
        
        return result
    
    async def encrypt_document_field(
        self,
        document_id: str,
        field_name: str,
        field_value: str,
        user_id: str
    ) -> EncryptionResult:
        """Encrypt specific document field"""
        result = await self.encryption.encrypt_field(
            field_name=field_name,
            field_value=field_value,
            record_id=document_id
        )
        
        # Log field encryption
        if self.config.enable_audit_integration:
            await log_document_event(
                self.audit,
                AuditEventType.DATA_ENCRYPTED,
                "encrypt_field",
                document_id,
                user_id,
                details={
                    'field_name': field_name,
                    'success': result.success
                }
            )
        
        return result
    
    # ==================== AUDIT METHODS ====================
    
    async def log_document_activity(
        self,
        activity_type: str,
        document_id: str,
        user_id: str,
        description: str,
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        """Log document-related activity"""
        try:
            event_type = AuditEventType(f"doc.{activity_type}")
        except ValueError:
            event_type = AuditEventType.DOCUMENT_VIEWED  # Default
        
        return await log_document_event(
            self.audit,
            event_type,
            activity_type,
            document_id,
            user_id,
            details=details
        )
    
    async def log_security_violation(
        self,
        description: str,
        user_id: Optional[str] = None,
        source_ip: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        """Log security violation"""
        return await log_security_event(
            self.audit,
            AuditEventType.SECURITY_VIOLATION,
            description,
            user_id,
            source_ip,
            AuditSeverity.HIGH,
            details
        )
    
    # ==================== SYSTEM MANAGEMENT METHODS ====================
    
    async def get_user_security_summary(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive security summary for user"""
        # Get user permissions
        permissions = await self.rbac.get_user_permissions(user_id)
        
        # Get document access
        accessible_docs = await self.doc_permissions.get_user_accessible_documents(user_id)
        
        # Get active sessions (simplified)
        sessions = await self.user_auth.get_user_sessions(user_id)
        
        return {
            'user_id': user_id,
            'permissions': permissions,
            'accessible_documents': len(accessible_docs),
            'active_sessions': len(sessions),
            'last_login': None,  # Would get from auth system
            'security_events_count': 0,  # Would get from audit system
            'mfa_enabled': False  # Would get from auth system
        }
    
    async def cleanup_expired_security_data(self) -> Dict[str, int]:
        """Clean up expired security data across all components"""
        cleanup_results = {}
        
        # Clean up expired API keys
        cleanup_results['api_keys'] = await self.api_auth.cleanup_expired_keys()
        
        # Clean up expired document access
        cleanup_results['document_access'] = await self.doc_permissions.cleanup_expired_access()
        
        # Clean up expired encryption keys
        cleanup_results['encryption_keys'] = await self.encryption.cleanup_expired_keys()
        
        # Clean up old audit logs
        cleanup_results['audit_logs'] = await self.audit.cleanup_old_logs()
        
        # Log cleanup event
        if self.config.enable_audit_integration:
            await self.audit.log_event(
                event_type=AuditEventType.SYSTEM_START,  # No specific cleanup event
                action="security_cleanup",
                description="Cleaned up expired security data",
                user_id=self.config.system_user_id,
                severity=AuditSeverity.LOW,
                details=cleanup_results
            )
        
        return cleanup_results
    
    async def get_security_metrics(self) -> Dict[str, Any]:
        """Get security system metrics and statistics"""
        audit_stats = await self.audit.get_audit_statistics()
        
        # Get other component stats (simplified)
        return {
            'audit_statistics': audit_stats,
            'total_users': len(self.user_auth.users),
            'active_sessions': len(self.user_auth.active_sessions),
            'total_api_keys': len(self.api_auth.api_keys),
            'total_roles': len(self.rbac.roles),
            'total_permissions': len(self.rbac.permissions),
            'encryption_keys': len(self.encryption.encryption_keys),
            'document_access_records': sum(len(accesses) for accesses in self.doc_permissions.document_access.values())
        }
    
    # ==================== INTEGRATION HELPERS ====================
    
    async def _initialize_system(self):
        """Initialize security system components"""
        if self.initialized:
            return
        
        try:
            # Create system user if enabled
            if self.config.auto_create_system_user:
                await self._create_system_user()
            
            # Create nyimbi user
            await self._create_nyimbi_user()
            
            # Initialize any required background tasks
            await self._setup_background_tasks()
            
            self.initialized = True
            self.logger.info("Security system initialization completed")
        
        except Exception as e:
            self.logger.error(f"Security system initialization failed: {e}")
    
    async def _create_system_user(self):
        """Create system user account"""
        try:
            system_user_id = await self.user_auth.create_user(
                username=self.config.system_user_id,
                password=secrets.token_urlsafe(32) + '!',  # Random password with special char
                require_mfa=False
            )
            
            # Assign admin role to system user
            admin_role_id = await self._find_role_by_name("Admin")
            if admin_role_id:
                await self.rbac.assign_role_to_user(
                    system_user_id, admin_role_id, "system_init"
                )
            
            self.logger.info("Created system user account")
        
        except Exception as e:
            if "already exists" not in str(e):
                self.logger.error(f"Failed to create system user: {e}")
    
    async def _find_role_by_name(self, role_name: str) -> Optional[str]:
        """Find role ID by name"""
        for role_id, role in self.rbac.roles.items():
            if role.name == role_name:
                return role_id
        return None


    async def _create_nyimbi_user(self):
        """Create nyimbi user account"""
        password = os.getenv("DOCFUSION_NYIMBI_INITIAL_PASSWORD")
        if not password:
            self.logger.info("Skipping nyimbi user creation; DOCFUSION_NYIMBI_INITIAL_PASSWORD is not set")
            return

        try:
            user_id = await self.user_auth.create_user(
                username='nyimbi',
                password=password,
                email='nyimbi@gmail.com',
                require_mfa=False
            )
            self.logger.info(f'Created nyimbi user account: {user_id}')
        except ValueError as e:
            if 'already exists' in str(e):
                self.logger.info('nyimbi user already exists')
            else:
                self.logger.error(f'Failed to create nyimbi user: {e}')
        except Exception as e:
            if 'already exists' not in str(e):
                self.logger.error(f'Failed to create nyimbi user: {e}')
    
    async def _setup_background_tasks(self):
        """Set up background security tasks"""
        # Set up periodic cleanup task
        async def periodic_cleanup():
            while True:
                try:
                    await asyncio.sleep(86400)  # Daily cleanup
                    await self.cleanup_expired_security_data()
                except Exception as e:
                    self.logger.error(f"Background cleanup error: {e}")
        
        asyncio.create_task(periodic_cleanup())
    
    async def close(self):
        """Clean shutdown of security system"""
        await self.audit.close()
        self.logger.info("Security manager closed")


# Factory function
def create_security_manager(config: Optional[SecurityManagerConfiguration] = None) -> SecurityManager:
    """Create SecurityManager instance with optional configuration"""
    return SecurityManager(config)
