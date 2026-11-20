/// Chrome from GET /public/legal-chrome (fail closed).
class LegalChrome {
  const LegalChrome({
    required this.privacyTitle,
    required this.termsTitle,
    required this.refundsTitle,
    required this.lastUpdatedLabel,
    required this.privacyNavLabel,
    required this.termsNavLabel,
    required this.refundsNavLabel,
    required this.supportEmailKey,
    required this.legalUnavailable,
    required this.backAction,
  });

  final String privacyTitle;
  final String termsTitle;
  final String refundsTitle;
  final String lastUpdatedLabel;
  final String privacyNavLabel;
  final String termsNavLabel;
  final String refundsNavLabel;
  final String supportEmailKey;
  final String legalUnavailable;
  final String backAction;

  bool get isReady =>
      privacyTitle.isNotEmpty &&
      termsTitle.isNotEmpty &&
      refundsTitle.isNotEmpty &&
      lastUpdatedLabel.isNotEmpty &&
      privacyNavLabel.isNotEmpty &&
      termsNavLabel.isNotEmpty &&
      refundsNavLabel.isNotEmpty &&
      supportEmailKey.isNotEmpty &&
      legalUnavailable.isNotEmpty &&
      backAction.isNotEmpty;

  String titleFor(LegalDocKind kind) {
    switch (kind) {
      case LegalDocKind.privacy:
        return privacyTitle;
      case LegalDocKind.terms:
        return termsTitle;
      case LegalDocKind.refunds:
        return refundsTitle;
    }
  }

  /// Returns null when any required field is missing (fail closed).
  static LegalChrome? fromJson(Map<String, dynamic> json) {
    String s(String k) => (json[k] as String?)?.trim() ?? '';
    final chrome = LegalChrome(
      privacyTitle: s('privacy_title'),
      termsTitle: s('terms_title'),
      refundsTitle: s('refunds_title'),
      lastUpdatedLabel: s('last_updated_label'),
      privacyNavLabel: s('privacy_nav_label'),
      termsNavLabel: s('terms_nav_label'),
      refundsNavLabel: s('refunds_nav_label'),
      supportEmailKey: s('support_email_key'),
      legalUnavailable: s('legal_unavailable'),
      backAction: s('back_action'),
    );
    return chrome.isReady ? chrome : null;
  }
}

class LegalSection {
  const LegalSection({
    required this.heading,
    required this.body,
    required this.contactLead,
    required this.contactTrail,
    required this.usesSupportEmail,
  });

  final String heading;
  final String body;
  final String contactLead;
  final String contactTrail;
  final bool usesSupportEmail;

  factory LegalSection.fromJson(Map<String, dynamic> json) {
    return LegalSection(
      heading: (json['heading'] as String?)?.trim() ?? '',
      body: (json['body'] as String?)?.trim() ?? '',
      contactLead: (json['contact_lead'] as String?)?.trim() ?? '',
      contactTrail: (json['contact_trail'] as String?)?.trim() ?? '',
      usesSupportEmail: json['uses_support_email'] == true,
    );
  }
}

class LegalDocument {
  const LegalDocument({
    required this.sections,
    required this.supportEmail,
  });

  final List<LegalSection> sections;
  final String supportEmail;

  bool get isReady =>
      sections.isNotEmpty && sections.every((s) => s.body.isNotEmpty);

  /// Returns null when sections are missing or empty (fail closed).
  static LegalDocument? fromJson(Map<String, dynamic> json) {
    final sections = (json['sections'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(LegalSection.fromJson)
        .toList();
    final doc = LegalDocument(
      sections: sections,
      supportEmail: (json['support_email'] as String?)?.trim() ?? '',
    );
    return doc.isReady ? doc : null;
  }
}

enum LegalDocKind { privacy, terms, refunds }

extension LegalDocKindPath on LegalDocKind {
  String get pathSegment {
    switch (this) {
      case LegalDocKind.privacy:
        return 'privacy';
      case LegalDocKind.terms:
        return 'terms';
      case LegalDocKind.refunds:
        return 'refunds';
    }
  }
}
